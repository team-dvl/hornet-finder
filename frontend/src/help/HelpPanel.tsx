import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Form, Offcanvas } from 'react-bootstrap';
import { ModuleCard } from '../components/home';
import { IconButton } from '../components/ui';
import { documentedModules, findModule } from '../config/modules';
import { useOverlayHistory } from '../hooks/useOverlayHistory';
import { useUserPermissions } from '../hooks/useUserPermissions';
import { ACTION_ICONS } from '../utils/icons';
import type { DocModuleId } from './anchors';
import { clearHighlights, CURRENT_CLASS, highlightTerm } from './highlight';
import type { HelpRequest } from './helpStore';
import { DOC_PAGES } from './registry';
import { searchDocs, type DocHit } from './searchDocs';
import { MIN_TERM_LENGTH, sectionTitle } from './text';

interface HelpPanelProps {
  open: boolean;
  request: HelpRequest | null;
  onHide: () => void;
}

interface SectionInfo {
  id: string;
  title: string;
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Scrolls `body` so that `target` sits near its top (or a third down, to read around a match). */
function scrollBodyTo(body: HTMLElement, target: HTMLElement, offset: number, smooth: boolean) {
  const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - offset;
  body.scrollTo({ top: Math.max(0, top), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
}

/**
 * Search inside the documentation on screen: highlights every occurrence of
 * `term`, and steps through them. The marks live in the document's own DOM
 * and are removed again when the search ends or the document changes.
 */
function useDocHighlight(body: HTMLElement | null, term: string, enabled: boolean, startAnchor: string | null) {
  const [position, setPosition] = useState({ count: 0, current: -1 });
  const marksRef = useRef<HTMLElement[]>([]);

  const goTo = useCallback((index: number) => {
    const marks = marksRef.current;
    if (!body || marks.length === 0) return;
    const next = (index + marks.length) % marks.length;
    marks.forEach((mark) => mark.classList.remove(CURRENT_CLASS));
    marks[next].classList.add(CURRENT_CLASS);
    scrollBodyTo(body, marks[next], body.clientHeight / 3, false);
    setPosition({ count: marks.length, current: next });
  }, [body]);

  useEffect(() => {
    if (!body || !enabled) return undefined;
    const marks = highlightTerm(body, term);
    marksRef.current = marks;
    if (marks.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the DOM marks just built
      setPosition({ count: 0, current: -1 });
    } else {
      // Starts at the section the search result came from, when there is one
      const first = startAnchor ? marks.findIndex((mark) => mark.closest('[data-section]')?.getAttribute('data-section') === startAnchor) : 0;
      goTo(Math.max(0, first));
    }
    return () => {
      clearHighlights(body);
      marksRef.current = [];
    };
  }, [body, term, enabled, startAnchor, goTo]);

  return {
    count: enabled ? position.count : 0,
    current: enabled ? position.current : -1,
    next: () => goTo(position.current + 1),
    previous: () => goTo(position.current - 1),
  };
}

/** Results of a search over all the documentation */
function SearchResults({ term, moduleIds, onPick }: {
  term: string;
  moduleIds: DocModuleId[];
  onPick: (hit: DocHit) => void;
}) {
  const [found, setFound] = useState<{ term: string; hits: DocHit[] } | null>(null);
  const moduleKey = moduleIds.join(',');

  useEffect(() => {
    let cancelled = false;
    void searchDocs(term, moduleKey ? (moduleKey.split(',') as DocModuleId[]) : []).then((hits) => {
      if (!cancelled) setFound({ term, hits });
    });
    return () => {
      cancelled = true;
    };
  }, [term, moduleKey]);

  if (found?.term !== term) return null;
  if (found.hits.length === 0) {
    return <p className="text-muted text-center my-4">Aucun résultat.</p>;
  }
  return (
    <div className="help-results" role="list">
      {found.hits.map((hit) => {
        const module = findModule(hit.moduleId);
        return (
          <button
            key={`${hit.moduleId}#${hit.anchor ?? ''}`}
            type="button"
            role="listitem"
            className="help-result"
            onClick={() => onPick(hit)}
          >
            <span className="help-result-path">
              <i className={`bi ${module?.icon} module-icon me-1`} data-tone={module?.tone} aria-hidden="true" />
              {module?.shortTitle} › {hit.sectionTitle}
            </span>
            <span className="help-result-snippet">
              {hit.before}<mark className="help-hit">{hit.match}</mark>{hit.after}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HelpPanelContent({ request, onHide }: { request: HelpRequest; onHide: () => void }) {
  const { roles } = useUserPermissions();
  const modules = documentedModules(roles);
  const documented = modules.filter((m) => m.id in DOC_PAGES);

  // A module the user has no access to is not even named here
  const [moduleId, setModuleId] = useState<DocModuleId | null>(
    request.moduleId && documented.some((m) => m.id === request.moduleId) ? request.moduleId : null,
  );
  const [startAnchor, setStartAnchor] = useState<string | null>(request.moduleId ? request.anchor : null);
  const [searching, setSearching] = useState(request.term !== '');
  const [term, setTerm] = useState(request.term);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [currentSection, setCurrentSection] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(false);

  const module = moduleId ? findModule(moduleId) : undefined;
  const Doc = moduleId ? DOC_PAGES[moduleId] : null;
  const highlight = useDocHighlight(body, term, searching && Boolean(moduleId), startAnchor);

  const scrollToSection = useCallback((id: string, smooth: boolean) => {
    const target = body?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!body || !target) return;
    scrollBodyTo(body, target, 4, smooth);
    target.classList.add('help-section-flash');
    window.setTimeout(() => target.classList.remove('help-section-flash'), 1200);
  }, [body]);

  // Sections of the documentation on screen, for the "Aller à" list
  useLayoutEffect(() => {
    if (!body || !moduleId) return;
    const found = Array.from(body.querySelectorAll<HTMLElement>('[data-section]')).map((el) => ({
      id: el.dataset.section ?? '',
      title: sectionTitle(el),
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the sections React just rendered
    setSections(found);
    setCurrentSection(found[0]?.id ?? '');
  }, [body, moduleId]);

  // Opening on a section (a help tip, a search result): go there, unless a search takes over
  useEffect(() => {
    if (body && moduleId && startAnchor && !searching) scrollToSection(startAnchor, false);
    // Only when the document appears: later searches and scrolling are the user's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, moduleId]);

  useEffect(() => {
    if (searching && focusSearch.current) inputRef.current?.focus({ preventScroll: true });
  }, [searching]);

  // Escape ends the search first, then closes the panel
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (searching) {
        setSearching(false);
        setTerm('');
      } else {
        onHide();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searching, onHide]);

  const handleScroll = () => {
    if (!body) return;
    setScrolled(body.scrollTop > body.clientHeight * 0.8);
    if (!moduleId) return;
    const limit = body.getBoundingClientRect().top + 24;
    let current = sections[0]?.id ?? '';
    for (const section of sections) {
      const el = body.querySelector<HTMLElement>(`[data-section="${section.id}"]`);
      if (el && el.getBoundingClientRect().top <= limit) current = section.id;
    }
    // The last sections may be too short to ever reach the top: at the very end, the last one counts
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) current = sections[sections.length - 1]?.id ?? current;
    setCurrentSection(current);
  };

  const openModule = (id: DocModuleId, anchor: string | null) => {
    setModuleId(id);
    setStartAnchor(anchor);
    body?.scrollTo({ top: 0 });
  };

  const backToList = () => {
    setSearching(false);
    setTerm('');
    setModuleId(null);
    setStartAnchor(null);
    body?.scrollTo({ top: 0 });
  };

  const toggleSearch = () => {
    focusSearch.current = !searching;
    if (searching) setTerm('');
    setSearching(!searching);
  };

  const globalSearch = searching && !moduleId && term.trim().length >= MIN_TERM_LENGTH;
  const searchLabel = module ? 'Rechercher dans la page' : 'Rechercher dans toute l’aide';

  return (
    <>
      <Offcanvas.Header closeButton closeLabel="Fermer" className="help-panel-header">
        {module && (
          <IconButton
            variant="link"
            className="text-body"
            icon={ACTION_ICONS.back}
            label="Toute l’aide"
            showLabel="never"
            onClick={backToList}
          />
        )}
        <Offcanvas.Title as="h6" id="help-panel-title" className="help-panel-title text-truncate">
          {module ? <>Aide · {module.shortTitle}</> : 'Aide'}
        </Offcanvas.Title>
        <IconButton
          variant="link"
          className={searching ? 'text-primary' : 'text-body'}
          icon={ACTION_ICONS.search}
          label={searching ? 'Fermer la recherche' : searchLabel}
          showLabel="never"
          aria-pressed={searching}
          onClick={toggleSearch}
        />
      </Offcanvas.Header>

      {searching ? (
        <div className="help-search" role="search">
          <Form.Control
            ref={inputRef}
            type="search"
            value={term}
            placeholder={searchLabel}
            aria-label={searchLabel}
            enterKeyHint="search"
            autoComplete="off"
            onChange={(event) => {
              setTerm(event.target.value);
              setStartAnchor(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && module) {
                event.preventDefault();
                if (event.shiftKey) highlight.previous();
                else highlight.next();
              }
            }}
          />
          {module && term.trim().length >= MIN_TERM_LENGTH && (
            <>
              <span className="help-search-count text-muted" aria-live="polite">
                {highlight.count === 0 ? '0 résultat' : `${highlight.current + 1} / ${highlight.count}`}
              </span>
              <IconButton
                variant="link"
                className="text-body"
                icon="chevron-up"
                label="Résultat précédent"
                showLabel="never"
                disabled={highlight.count < 2}
                onClick={highlight.previous}
              />
              <IconButton
                variant="link"
                className="text-body"
                icon="chevron-down"
                label="Résultat suivant"
                showLabel="never"
                disabled={highlight.count < 2}
                onClick={highlight.next}
              />
            </>
          )}
        </div>
      ) : (
        module && (
          <div className="help-toc">
            <Form.Select
              aria-label="Aller à la section"
              value={currentSection}
              onChange={(event) => {
                setCurrentSection(event.target.value);
                scrollToSection(event.target.value, true);
              }}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </Form.Select>
          </div>
        )
      )}

      <Offcanvas.Body ref={setBody} onScroll={handleScroll} className="help-panel-body">
        {Doc ? (
          <Doc />
        ) : globalSearch ? (
          <SearchResults
            term={term}
            moduleIds={documented.map((m) => m.id as DocModuleId)}
            onPick={(hit) => openModule(hit.moduleId, hit.anchor)}
          />
        ) : (
          <div className="tile-grid">
            {modules.map((m) => (
              <ModuleCard
                key={m.id}
                title={m.title}
                description={m.description}
                icon={m.icon}
                tone={m.tone}
                badge={m.id in DOC_PAGES ? undefined : 'À venir'}
                onClick={m.id in DOC_PAGES ? () => openModule(m.id as DocModuleId, null) : undefined}
              />
            ))}
          </div>
        )}
        {scrolled && (
          <div className="back-to-top">
            <button
              type="button"
              className="btn btn-light shadow-sm rounded-circle"
              aria-label="Revenir en haut"
              title="Revenir en haut"
              onClick={() => body?.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <i className="bi bi-arrow-up" aria-hidden="true" />
            </button>
          </div>
        )}
      </Offcanvas.Body>
    </>
  );
}

/**
 * Help panel: the documentation of the modules, sliding in from the right
 * over the page and over any dialog. Opened by `openHelp` (help tips, menu).
 * Each opening starts from a fresh state (`key`), then the user can move
 * between the list of modules, a module's documentation and the search.
 */
export default function HelpPanel({ open, request, onHide }: HelpPanelProps) {
  useOverlayHistory(open, onHide);
  return (
    <Offcanvas
      show={open}
      onHide={onHide}
      placement="end"
      keyboard={false}
      className="help-panel"
      backdropClassName="help-panel-backdrop"
      aria-labelledby="help-panel-title"
    >
      {request && <HelpPanelContent key={request.seq} request={request} onHide={onHide} />}
    </Offcanvas>
  );
}
