/**
 * Markdown of the visit reports and of the notes on a colony: shown by
 * `components/common/Markdown.tsx`, typed in `MarkdownEditor.tsx`.
 */

/** The text without its Markdown marks, for a one-line preview in a list. */
export function markdownToPlain(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*- \[[ xX]\]\s+/gm, '')
    .replace(/(\*\*|__|~~|\*|_|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Edit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Wrap the selection in `mark` (bold, italic), or put the marks at the cursor. */
export function wrapSelection(text: string, start: number, end: number, mark: string, placeholder: string): Edit {
  const selected = text.slice(start, end) || placeholder;
  const next = `${text.slice(0, start)}${mark}${selected}${mark}${text.slice(end)}`;
  return { text: next, selectionStart: start + mark.length, selectionEnd: start + mark.length + selected.length };
}

/** Prefix each line touched by the selection (`## `, `- `, numbered list). */
export function prefixLines(text: string, start: number, end: number, prefix: (index: number) => string): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = text.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const lines = text.slice(lineStart, lineEnd).split('\n').map((line, index) => `${prefix(index)}${line}`);
  const block = lines.join('\n');
  return {
    text: `${text.slice(0, lineStart)}${block}${text.slice(lineEnd)}`,
    selectionStart: lineStart + prefix(0).length,
    selectionEnd: lineStart + block.length,
  };
}

/** A link on the selection: `[text](https://)`, the address selected to be typed. */
export function insertLink(text: string, start: number, end: number): Edit {
  const label = text.slice(start, end) || 'lien';
  const url = 'https://';
  const next = `${text.slice(0, start)}[${label}](${url})${text.slice(end)}`;
  const urlStart = start + label.length + 3;
  return { text: next, selectionStart: urlStart, selectionEnd: urlStart + url.length };
}
