import { foldText, MIN_TERM_LENGTH } from './text';

const MARK_CLASS = 'help-hit';
export const CURRENT_CLASS = 'help-hit-current';

/** Removes the highlights of `container`, leaving its text as it was. */
export function clearHighlights(container: HTMLElement): void {
  container.querySelectorAll(`mark.${MARK_CLASS}`).forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });
  container.normalize();
}

/**
 * Wraps every occurrence of `term` (case and accent insensitive) in a `<mark>`
 * and returns the marks in reading order. The container must be left alone by
 * React in the meantime: the documentation is static, and callers clear the
 * highlights before it can change.
 */
export function highlightTerm(container: HTMLElement, term: string): HTMLElement[] {
  clearHighlights(container);
  const needle = foldText(term.trim());
  if (needle.length < MIN_TERM_LENGTH) return [];

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

  const marks: HTMLElement[] = [];
  for (const node of nodes) {
    const folded = foldText(node.data);
    const starts: number[] = [];
    for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle, at + needle.length)) {
      starts.push(at);
    }
    // Last first, so that splitting a node does not shift the next indexes
    const nodeMarks: HTMLElement[] = [];
    for (const start of starts.reverse()) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + needle.length);
      const mark = document.createElement('mark');
      mark.className = MARK_CLASS;
      range.surroundContents(mark);
      nodeMarks.unshift(mark);
    }
    marks.push(...nodeMarks);
  }
  return marks;
}
