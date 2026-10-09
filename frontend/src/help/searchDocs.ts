import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { DOC_PAGES } from './registry';
import type { DocModuleId } from './anchors';
import { foldText, MIN_TERM_LENGTH, sectionTitle } from './text';

/** One section (or the introduction) of a module's documentation, as plain text */
interface IndexedSection {
  moduleId: DocModuleId;
  /** `null` for the introduction, before the first section */
  anchor: string | null;
  title: string;
  text: string;
  folded: string;
}

export interface DocHit {
  moduleId: DocModuleId;
  anchor: string | null;
  sectionTitle: string;
  /** Text around the first occurrence, split so that the match can be highlighted */
  before: string;
  match: string;
  after: string;
}

const CONTEXT_BEFORE = 40;
const CONTEXT_AFTER = 70;

let indexPromise: Promise<IndexedSection[]> | null = null;

/** Block boundaries become spaces, so that words of two paragraphs do not stick together */
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

/** Renders a documentation off screen and returns its HTML. */
function renderToHtml(Doc: (typeof DOC_PAGES)[DocModuleId]): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(Doc)));
  const html = host.innerHTML;
  root.unmount();
  return html;
}

/** Renders each module's documentation once, off screen, and cuts it into sections. */
async function buildIndex(): Promise<IndexedSection[]> {
  // Leaves the effect that asked for the search: flushSync must not run inside a React lifecycle
  await Promise.resolve();
  const sections: IndexedSection[] = [];
  for (const [moduleId, Doc] of Object.entries(DOC_PAGES) as [DocModuleId, (typeof DOC_PAGES)[DocModuleId]][]) {
    const doc = new DOMParser().parseFromString(`<div>${renderToHtml(Doc)}</div>`, 'text/html').body.firstElementChild!;
    const add = (anchor: string | null, title: string, html: string) => {
      const text = plainText(html);
      if (text) sections.push({ moduleId, anchor, title, text, folded: foldText(text) });
    };
    let intro = '';
    for (const child of Array.from(doc.children)) {
      const anchor = child.getAttribute('data-section');
      if (anchor) {
        add(anchor, sectionTitle(child), child.innerHTML);
      } else {
        intro += ` ${child.outerHTML}`;
      }
    }
    add(null, 'Présentation', intro);
  }
  return sections;
}

/** Sections of the given modules containing `term`, first occurrence shown. */
export async function searchDocs(term: string, moduleIds: DocModuleId[]): Promise<DocHit[]> {
  const needle = foldText(term.trim());
  if (needle.length < MIN_TERM_LENGTH) return [];
  indexPromise ??= buildIndex();
  const index = await indexPromise;
  const hits: DocHit[] = [];
  for (const section of index) {
    if (!moduleIds.includes(section.moduleId)) continue;
    const at = section.folded.indexOf(needle);
    if (at < 0) continue;
    const end = at + needle.length;
    hits.push({
      moduleId: section.moduleId,
      anchor: section.anchor,
      sectionTitle: section.title,
      before: (at > CONTEXT_BEFORE ? '…' : '') + section.text.slice(Math.max(0, at - CONTEXT_BEFORE), at),
      match: section.text.slice(at, end),
      after: section.text.slice(end, end + CONTEXT_AFTER) + (end + CONTEXT_AFTER < section.text.length ? '…' : ''),
    });
  }
  return hits;
}
