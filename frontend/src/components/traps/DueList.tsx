import { useEffect, useRef } from 'react';
import { Button } from 'react-bootstrap';
import { AuthImage, HelpTip } from '../common';
import type { Trap } from '../../store/store';
import type { DueItem } from '../../utils/dueApi';
import { ACTION_ICONS } from '../../utils/icons';

interface DueListProps {
  items: DueItem[];
  /** Trap to bring into view (from a notification) */
  highlight?: number | null;
  onOpen: (trap: Trap) => void;
  onRead: (trap: Trap) => void;
  onRefill: (trap: Trap) => void;
}

const days = (count: number) => `${count} j`;

function since(item: DueItem): string {
  const elapsed = item.interval_days + item.days_late;
  if (item.from_installation) return `Installé il y a ${days(elapsed)}`;
  return item.kind === 'trap_reading' ? `Dernier relevé il y a ${days(elapsed)}` : `Dernière recharge il y a ${days(elapsed)}`;
}

function status(item: DueItem): string {
  if (item.days_late > 0) return `En retard de ${days(item.days_late)}`;
  if (item.days_late === 0) return "À faire aujourd'hui";
  return item.days_late === -1 ? 'Demain' : `Dans ${days(-item.days_late)}`;
}

const SECTIONS: { title: string; match: (item: DueItem) => boolean; tone: string }[] = [
  { title: 'En retard', match: (item) => item.days_late > 0, tone: 'text-danger fw-semibold' },
  { title: "Aujourd'hui", match: (item) => item.days_late === 0, tone: 'text-warning-emphasis' },
  { title: 'Bientôt', match: (item) => item.days_late < 0, tone: 'text-muted' },
];

/**
 * What the user's traps wait for, one row per trap and kind of reminder (a
 * reading, the attractant), most overdue first. "Relever" and "Recharger"
 * open the usual journal form; a tap on the row opens the trap's sheet.
 */
export default function DueList({ items, highlight, onOpen, onRead, onRefill }: DueListProps) {
  const highlighted = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    highlighted.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight, items]);

  if (items.length === 0) {
    return (
      <div className="text-center text-muted py-5">
        <div className="display-6" aria-hidden="true">🪤</div>
        <span className="d-inline-flex align-items-center">
          Rien à relever.
          <HelpTip id="due-empty-help" doc="traps#reminders" title="À relever">
            Un piège apparaît ici quand son relevé ou le renouvellement de son attractif arrive à échéance, selon les
            délais de son type. Les pièges remisés n'apparaissent pas.
          </HelpTip>
        </span>
      </div>
    );
  }

  return (
    <>
      {SECTIONS.map((section) => {
        const rows = items.filter(section.match);
        if (rows.length === 0) return null;
        return (
          <section key={section.title} className="mb-3">
            <h2 className="h6 text-uppercase text-muted mb-1">{section.title}</h2>
            <div className="list-group">
              {rows.map((item) => {
                const isHighlighted = item.trap.id === highlight;
                const refill = item.kind === 'trap_refill';
                // Its own photo, else the one of its type, as in the trap manager
                const thumbnail = item.trap.photo_thumbnail_url ?? item.trap.trap_type.photo_thumbnail_url ?? null;
                return (
                  <div
                    key={`${item.trap.id}-${item.kind}`}
                    ref={isHighlighted ? highlighted : undefined}
                    className={`list-group-item due-item d-flex align-items-center gap-2 py-2 px-2${isHighlighted ? ' list-group-item-warning' : ''}`}
                  >
                    <button
                      type="button"
                      className="btn p-0 border-0 text-start d-flex align-items-center gap-2 flex-grow-1 min-w-0"
                      onClick={() => onOpen(item.trap)}
                      aria-label={`Fiche du piège #${item.trap.id}`}
                    >
                      <span className="manager-list-thumb flex-shrink-0 rounded">
                        {thumbnail ? <AuthImage src={thumbnail} alt="" className="rounded" /> : <span aria-hidden="true">🪤</span>}
                      </span>
                      <span className="d-block min-w-0">
                        <span className="d-block text-truncate">
                          <strong>#{item.trap.id}</strong> · {item.trap.trap_type.name}
                        </span>
                        <span className="d-block small text-muted text-truncate">
                          {since(item)} · tous les {days(item.interval_days)}
                        </span>
                        <span className={`d-block small ${section.tone}`}>
                          {refill ? 'Attractif à renouveler' : 'Relevé'} · {status(item)}
                        </span>
                      </span>
                    </button>
                    {item.days_late >= 0 && (
                      <Button
                        variant="primary"
                        className="flex-shrink-0"
                        onClick={() => (refill ? onRefill(item.trap) : onRead(item.trap))}
                      >
                        <i className={`bi bi-${refill ? ACTION_ICONS.refill : ACTION_ICONS.catch} me-1`} aria-hidden="true" />
                        {refill ? 'Recharger' : 'Relever'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
