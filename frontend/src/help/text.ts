/**
 * Lower-cased text without accents, one character for each character of the
 * input, so that an index in the folded text is an index in the original.
 */
export function foldText(text: string): string {
  let out = '';
  for (const char of text) {
    const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base.length === char.length ? base.toLowerCase() : char.toLowerCase();
  }
  return out;
}

/** Shortest search term worth looking for */
export const MIN_TERM_LENGTH = 2;

/** Heading of a documentation section, without the emoji span that precedes its text. */
export function sectionTitle(section: Element): string {
  const heading = section.querySelector('h5, h6')?.cloneNode(true) as Element | undefined;
  heading?.querySelectorAll('span').forEach((span) => span.remove());
  return (heading?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
