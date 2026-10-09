import { Badge } from 'react-bootstrap';
import type { AuditEvent } from '../../utils/auditApi';
import { actionLabel, actorLabel, eventSummary } from '../../utils/auditLabels';
import { formatTime } from '../../utils/format';
import { ADMIN } from '../../utils/roles';
import AuditDomainIcon from './AuditDomainIcon';

interface AuditEventRowProps {
  event: AuditEvent;
  onOpen: (event: AuditEvent) => void;
}

/** One event of the list: what, on which object, who and when. A tap opens the detail. */
export default function AuditEventRow({ event, onOpen }: AuditEventRowProps) {
  const actor = actorLabel(event);
  return (
    <button type="button" className="audit-row" onClick={() => onOpen(event)}>
      <span className="audit-row-icon"><AuditDomainIcon domain={event.domain} /></span>
      <span className="audit-row-main">
        <span className="audit-row-top">
          <span className="fw-semibold text-truncate">{actionLabel(event.action)}</span>
          <span className="small text-muted flex-shrink-0">{formatTime(event.occurred_at)}</span>
        </span>
        <span className="small text-muted text-truncate d-block">{eventSummary(event)}</span>
        <span className="small d-flex align-items-center gap-1 min-w-0">
          <span className={`text-truncate${actor.muted ? ' fst-italic text-muted' : ''}`}>{actor.text}</span>
          {event.actor_roles.includes(ADMIN) && <Badge bg="warning" text="dark" className="fw-normal flex-shrink-0">admin</Badge>}
          {event.source === 'backfill' && (
            <Badge bg="light" text="dark" className="fw-normal border flex-shrink-0">reconstitué</Badge>
          )}
        </span>
      </span>
    </button>
  );
}
