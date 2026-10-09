import { useSyncExternalStore } from 'react';
import { parseDocRef, type DocModuleId, type DocRef } from './anchors';

/** What the help panel is asked to show; `seq` changes on every opening. */
export interface HelpRequest {
  /** Module whose documentation opens, `null` for the list of all modules */
  moduleId: DocModuleId | null;
  /** Section to scroll to */
  anchor: string | null;
  /** Text to look for, already highlighted on opening */
  term: string;
  seq: number;
}

interface HelpState {
  open: boolean;
  /** Last request, kept after closing so that the panel can slide out */
  request: HelpRequest | null;
}

let state: HelpState = { open: false, request: null };
let seq = 0;
let closedAt = 0;
const listeners = new Set<() => void>();

function set(next: HelpState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * Opens the help panel, from anywhere (a help tip, the menu), over whatever
 * is already open. Without a reference it lists the modules; with one it opens
 * that module's documentation, at the section if the reference names one.
 */
export function openHelp(ref?: DocRef, term = ''): void {
  const target = ref ? parseDocRef(ref) : { moduleId: null, anchor: null };
  seq += 1;
  set({ open: true, request: { ...target, term, seq } });
}

export function closeHelp(): void {
  if (state.open) {
    closedAt = Date.now();
    set({ ...state, open: false });
  }
}

/** Delay after closing during which focus is handed back to the element that opened the panel */
const FOCUS_RESTORE_MS = 800;

/** Whether the panel has just closed: a focus received now is the panel giving it back, not the user's. */
export function helpJustClosed(): boolean {
  return Date.now() - closedAt < FOCUS_RESTORE_MS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHelpState(): HelpState {
  return useSyncExternalStore(subscribe, () => state);
}
