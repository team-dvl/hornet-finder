/**
 * Back button (Android) and back swipe (iOS) close the open dialog or sheet
 * instead of leaving the page underneath.
 *
 * While at least one overlay is open, one extra history entry sits on top of
 * the current one (same URL, react-router's state kept so the router sees no
 * navigation). Going back pops it and closes the topmost overlay. Closing
 * overlays from the UI removes the entry again.
 *
 * Changes are applied on the next tick, so that one overlay replacing another
 * (a sheet opening a form, a confirmation replacing a sheet) keeps the same
 * entry instead of popping and pushing history in a race.
 */

interface OverlayEntry {
  id: number;
  close: () => void;
}

const stack: OverlayEntry[] = [];
/** Marker of the history entry pushed by us, when it is (believed) on top */
let token: string | null = null;
let ignoreNextPop = false;
let timer: number | null = null;
let nextId = 1;
let listening = false;

function onPopState() {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  if (!token) return;
  // Our entry has just been popped: close the topmost overlay. If another one
  // stays open underneath, the next sync pushes a new entry for it.
  token = null;
  stack[stack.length - 1]?.close();
  sync();
}

function sync() {
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    if (stack.length > 0 && !token) {
      token = `overlay-${Date.now()}-${nextId}`;
      window.history.pushState({ ...window.history.state, overlay: token }, '');
    } else if (stack.length === 0 && token) {
      const onTop = window.history.state?.overlay === token;
      token = null;
      // After a navigation (a link followed from a dialog), our entry is no
      // longer on top: going back would undo that navigation
      if (onTop) {
        ignoreNextPop = true;
        window.history.back();
      }
    }
  }, 0);
}

/** Register an open overlay; returns the function that unregisters it. */
export function registerOverlay(close: () => void): () => void {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const entry = { id: nextId++, close };
  stack.push(entry);
  sync();
  return () => {
    const index = stack.findIndex((item) => item.id === entry.id);
    if (index >= 0) stack.splice(index, 1);
    sync();
  };
}
