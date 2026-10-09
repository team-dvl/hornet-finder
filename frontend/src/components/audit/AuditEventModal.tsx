import { Badge, Button } from 'react-bootstrap';
import type { AuditEvent } from '../../utils/auditApi';
import {
  actionLabel, actorLabel, fieldLabel, formatValue, hasHistory, objectName, refName, splitChanges,
} from '../../utils/auditLabels';
import { ACTION_ICONS } from '../../utils/icons';
import { ADMIN, ROLE_LABELS } from '../../utils/roles';
import { AppModal, FieldRow, IconButton } from '../ui';
import AuditDomainIcon from './AuditDomainIcon';

const SOURCE_LABELS: Record<AuditEvent['source'], string> = {
  api: 'Application',
  system: 'Automatique',
  backfill: 'Reconstitué à la mise en service',
};

/** What a link of the detail asks the list for: the history of an object, a person, a request */
export interface AuditFocus {
  ref?: string;
  refName?: string;
  actor?: string;
  actorName?: string;
  request?: string;
}

interface AuditEventModalProps {
  event: AuditEvent | null;
  onHide: () => void;
  onFocus: (focus: AuditFocus) => void;
}

/** Detail of an event: who, when, the object, and what changed (before → after). */
export default function AuditEventModal({ event, onHide, onFocus }: AuditEventModalProps) {
  if (!event) return null;
  const actor = actorLabel(event);
  const targetRef = event.target_id ? `${event.target_type}:${event.target_id}` : null;
  const targetName = objectName(event.target_type, event.target_id, event.people);
  const { diffs, facts } = splitChanges(event.changes);
  const deletion = event.action.endsWith('.deleted');
  const roles = event.actor_roles.map((role) => (ROLE_LABELS as Record<string, string>)[role] ?? role);
  const otherRefs = event.refs.filter((ref) => ref !== targetRef);

  return (
    <AppModal
      show
      onHide={onHide}
      icon={<AuditDomainIcon domain={event.domain} />}
      title={actionLabel(event.action)}
      footer={(
        <>
          {targetRef && hasHistory(targetRef) && (
            <IconButton
              variant="outline-secondary"
              icon={ACTION_ICONS.history}
              label="Historique de l'objet"
              onClick={() => onFocus({ ref: targetRef, refName: targetName })}
            />
          )}
          {event.actor && (
            <IconButton
              variant="outline-secondary"
              icon="person"
              label="Actions de cette personne"
              onClick={() => onFocus({ actor: event.actor!, actorName: actor.text })}
            />
          )}
          {event.request_id && (
            <IconButton
              variant="outline-secondary"
              icon="link-45deg"
              label="Même requête"
              onClick={() => onFocus({ request: event.request_id! })}
            />
          )}
        </>
      )}
    >
      <FieldRow label="Quand">
        {new Date(event.occurred_at).toLocaleString('fr-BE', { dateStyle: 'full', timeStyle: 'medium' })}
      </FieldRow>
      <FieldRow label="Qui">
        <span className={actor.muted ? 'fst-italic text-muted' : undefined}>{actor.text}</span>
        {event.actor_roles.includes(ADMIN) && <Badge bg="warning" text="dark" className="fw-normal ms-1">admin</Badge>}
      </FieldRow>
      {roles.length > 0 && <FieldRow label="Rôles">{roles.join(', ')}</FieldRow>}
      {event.target_type && (
        <FieldRow label="Objet">
          {targetName}
          {event.target_label && <span className="text-muted"> · {event.target_label}</span>}
          {deletion && <Badge bg="danger" className="fw-normal ms-1">supprimé</Badge>}
        </FieldRow>
      )}
      <FieldRow label="Source">{SOURCE_LABELS[event.source]}</FieldRow>

      {diffs.length > 0 && (
        <>
          <h6 className="audit-section-title">Changements</h6>
          <div className="audit-diff">
            {diffs.map(([key, before, after]) => (
              <div key={key} className="audit-diff-row">
                <div className="small text-muted">{fieldLabel(key)}</div>
                <span className="audit-old">{formatValue(key, before, event.people)}</span>
                <i className="bi bi-arrow-right mx-1 text-muted" aria-label="devient" />
                <span className="audit-new">{formatValue(key, after, event.people)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {facts.length > 0 && (
        <>
          <h6 className="audit-section-title">{deletion ? 'État au moment de la suppression' : 'Détails'}</h6>
          {facts.map(([key, value]) => (
            <FieldRow key={key} label={fieldLabel(key)}>{formatValue(key, value, event.people)}</FieldRow>
          ))}
        </>
      )}

      {otherRefs.length > 0 && (
        <>
          <h6 className="audit-section-title">Concerne aussi</h6>
          <div className="d-flex flex-wrap gap-2">
            {otherRefs.slice(0, 20).map((ref) => (hasHistory(ref) ? (
              <Button
                key={ref}
                variant="outline-secondary"
                size="sm"
                className="rounded-pill audit-ref"
                title="Voir son historique"
                onClick={() => onFocus({ ref, refName: refName(ref, event.people) })}
              >
                {refName(ref, event.people)}
              </Button>
            ) : (
              <span key={ref} className="badge rounded-pill text-bg-light border fw-normal audit-ref">
                {refName(ref, event.people)}
              </span>
            )))}
            {otherRefs.length > 20 && <span className="small text-muted align-self-center">et {otherRefs.length - 20} autres</span>}
          </div>
        </>
      )}
    </AppModal>
  );
}
