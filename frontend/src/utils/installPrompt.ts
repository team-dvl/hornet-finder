import { useSyncExternalStore } from 'react';
import { isInstalledPwa } from './pwa';

/**
 * Suggestion to pin the app on the home screen.
 *
 * Chromium browsers (Android, desktop) hand the app an install prompt it can
 * trigger from its own button; Safari on iOS has no API, so the user is shown
 * the steps. The prompt event can fire before the UI mounts, hence the
 * listener registered as soon as this module is loaded.
 */

const VISITS_KEY = 'hornet-install-visits';
const VISIT_COUNTED_KEY = 'hornet-install-visit-counted';
const DISMISSED_KEY = 'hornet-install-dismissed';

/** The suggestion appears from this visit on (a visit = a session of the app). */
export const MIN_VISITS = 2;
/** Wait before suggesting again after the sheet was closed. */
export const REPROMPT_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Install prompt kept for the button (Chromium only) */
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  open: boolean;
}

let state: InstallState = { deferred: null, installed: isInstalledPwa(), open: false };
const listeners = new Set<() => void>();

function update(patch: Partial<InstallState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private window): the suggestion just stays quiet
  }
}

/** Counts this session once, however many times the page is reloaded. */
function countVisit(): void {
  try {
    if (sessionStorage.getItem(VISIT_COUNTED_KEY)) return;
    sessionStorage.setItem(VISIT_COUNTED_KEY, '1');
    write(VISITS_KEY, String(readNumber(VISITS_KEY) + 1));
  } catch {
    // No session storage: the visits are not counted
  }
}

export function isIos(): boolean {
  const { userAgent, platform, maxTouchPoints } = navigator;
  // iPadOS reports itself as a Mac, with a touch screen
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

if (typeof window !== 'undefined') {
  countVisit();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    update({ deferred: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => update({ deferred: null, installed: true, open: false }));
}

/** Can the app be pinned from here: not yet installed, and a prompt or steps to give. */
function canInstall(s: InstallState): boolean {
  return !s.installed && (s.deferred !== null || isIos());
}

/** The sheet opens by itself: second visit or later, touch screen, not refused for 30 days. */
export function shouldAutoOpen(): boolean {
  if (!canInstall(state) || !isTouchDevice()) return false;
  if (readNumber(VISITS_KEY) < MIN_VISITS) return false;
  return Date.now() - readNumber(DISMISSED_KEY) > REPROMPT_DELAY_MS;
}

export function openInstallSheet(): void {
  update({ open: true });
}

/** Closing the sheet, whatever the way, postpones the next suggestion. */
export function closeInstallSheet(): void {
  write(DISMISSED_KEY, String(Date.now()));
  update({ open: false });
}

/** Triggers the browser's install dialog (Chromium). */
export async function install(): Promise<void> {
  const { deferred } = state;
  if (!deferred) return;
  update({ open: false });
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  // The event can be used once
  update({ deferred: null });
  if (outcome === 'dismissed') write(DISMISSED_KEY, String(Date.now()));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState & { available: boolean; ios: boolean } {
  const current = useSyncExternalStore(subscribe, () => state);
  return { ...current, available: canInstall(current), ios: isIos() };
}
