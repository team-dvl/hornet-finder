import { useSyncExternalStore } from 'react';

/**
 * Look of the application: a palette (the brand colours) and a mode (light,
 * dark, or follow the system). Both live on <html> so that CSS does the work:
 * `data-theme` carries the palette, `data-bs-theme` the effective mode, which
 * is what Bootstrap 5.3 itself reads. The same logic runs once from the
 * inline script of index.html, before the first paint, to avoid a white flash.
 */

export const PALETTES = [
  { id: 'velutina', label: 'Velutina' },
  { id: 'foret', label: 'Forêt' },
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];

export const MODES = [
  { id: 'light', label: 'Clair', icon: 'sun' },
  { id: 'dark', label: 'Sombre', icon: 'moon-stars' },
  { id: 'auto', label: 'Auto', icon: 'circle-half' },
] as const;
export type ModeId = (typeof MODES)[number]['id'];

export const DEFAULT_PALETTE: PaletteId = 'velutina';
export const DEFAULT_MODE: ModeId = 'auto';

const PALETTE_KEY = 'theme.palette';
const MODE_KEY = 'theme.mode';

/** Colour of the navbar, reported to the browser (address bar, Android status bar). */
const BROWSER_COLOR: Record<PaletteId, Record<'light' | 'dark', string>> = {
  velutina: { light: '#1f1b16', dark: '#0d0b08' },
  foret: { light: '#17402f', dark: '#0a100d' },
};

export interface ThemeState {
  palette: PaletteId;
  mode: ModeId;
  /** Effective mode once `auto` is resolved against the system */
  dark: boolean;
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (value && (allowed as readonly string[]).includes(value)) return value as T;
  } catch {
    // Storage blocked (private window): the default applies
  }
  return fallback;
}

function resolve(palette: PaletteId, mode: ModeId): ThemeState {
  return { palette, mode, dark: mode === 'auto' ? systemDark.matches : mode === 'dark' };
}

function apply(state: ThemeState): void {
  const root = document.documentElement;
  root.dataset.theme = state.palette;
  root.dataset.bsTheme = state.dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BROWSER_COLOR[state.palette][state.dark ? 'dark' : 'light']);
}

let state = resolve(
  read(PALETTE_KEY, PALETTES.map((p) => p.id), DEFAULT_PALETTE),
  read(MODE_KEY, MODES.map((m) => m.id), DEFAULT_MODE),
);
const listeners = new Set<() => void>();

function commit(next: ThemeState): void {
  state = next;
  apply(state);
  listeners.forEach((listener) => listener());
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted, still applied for this session
  }
}

export function setPalette(palette: PaletteId): void {
  save(PALETTE_KEY, palette);
  commit(resolve(palette, state.mode));
}

export function setMode(mode: ModeId): void {
  save(MODE_KEY, mode);
  commit(resolve(state.palette, mode));
}

/** Applies the stored look and follows the system while the mode is `auto`. */
export function initTheme(): void {
  apply(state);
  systemDark.addEventListener('change', () => {
    if (state.mode === 'auto') commit(resolve(state.palette, 'auto'));
  });
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
