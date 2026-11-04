import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal, Switch } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { hiveErrorOf } from '../../utils/hivesApi';
import { refreshPending } from '../../utils/pending';
import {
  FOLLOW_UP_LABELS, planFollowUp, toLocalInput, type FollowUpProposal,
} from '../../utils/visitsApi';

interface FollowUpProposalsProps {
  proposals: FollowUpProposal[];
  /** Planned or not: the event's own dialog is done */
  onDone: () => void;
}

interface Choice {
  on: boolean;
  at: string;
}

/**
 * After an event of a colony, the visits that follow it up, proposed by the
 * server: its move out of the nucleus, the check that its new queen lays. Each
 * one is planned at the time proposed or another; the close button plans none.
 * It replaces the event's dialog (one dialog at a time).
 */
export default function FollowUpProposals({ proposals, onDone }: FollowUpProposalsProps) {
  const { userGuid } = useUserPermissions();
  const [choices, setChoices] = useState<Choice[]>(() => proposals.map((proposal) => ({
    on: true, at: toLocalInput(proposal.suggested_at),
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Planned already when a later one failed: a retry does not plan them twice
  const [planned, setPlanned] = useState<Set<number>>(() => new Set());

  const update = (index: number, change: Partial<Choice>) => setChoices((current) => current.map(
    (choice, position) => (position === index ? { ...choice, ...change } : choice)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const done = new Set(planned);
    try {
      for (const [index, proposal] of proposals.entries()) {
        const choice = choices[index];
        if (!choice.on || done.has(index) || !choice.at) continue;
        await planFollowUp(proposal, new Date(choice.at).toISOString(), userGuid ?? null);
        done.add(index);
      }
      refreshPending();
      onDone();
    } catch (planError) {
      setPlanned(done);
      setError(hiveErrorOf(planError));
      setSaving(false);
    }
  };

  const any = choices.some((choice, index) => choice.on && !planned.has(index));

  return (
    <AppModal
      show
      onHide={onDone}
      locked
      icon={<i className="bi bi-calendar-plus hive-icon" aria-hidden="true" />}
      title="Visites à prévoir"
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || !any}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-calendar-check me-2" aria-hidden="true" />}
          Prévoir
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {proposals.map((proposal, index) => {
        const choice = choices[index];
        const id = `follow-up-${index}`;
        return (
          <div key={`${proposal.follow_up}:${proposal.colony}`} className="border rounded px-2 pt-1 mb-3">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1 min-w-0">
                <Switch id={`${id}-on`} checked={choice.on && !planned.has(index)}
                  disabled={saving || planned.has(index)}
                  label={`${FOLLOW_UP_LABELS[proposal.follow_up]} · ${proposal.colony_label}`}
                  onChange={(on) => update(index, { on })} />
              </div>
              <HelpTip id={`${id}-help`} doc="apiaries#planning" title={FOLLOW_UP_LABELS[proposal.follow_up]}>
                {proposal.follow_up === 'nucleus_transfer'
                  ? "La colonie se repose quelques jours dans le nucleus (3 par défaut), puis passe dans sa ruche, "
                    + "tôt le matin. Le jour venu, « Réaliser » choisit la ruche et y transvase la colonie."
                  : "Une reine d'élevage naît 12 à 16 jours après la division, se fait féconder 5 à 10 jours plus "
                    + "tard et pond 2 à 4 jours après : les premiers œufs vers 20 à 30 jours. Le contrôle est prévu "
                    + "à 25 jours ; des œufs vus enregistrent la ponte."}
              </HelpTip>
            </div>
            <div className="small text-muted text-truncate mb-2">{proposal.hive_label}</div>
            {choice.on && !planned.has(index) && (
              <Form.Group className="mb-2" controlId={`${id}-at`}>
                <Form.Label className="obs-label mb-1">Le</Form.Label>
                <Form.Control type="datetime-local" value={choice.at} required disabled={saving}
                  onChange={(event) => update(index, { at: event.target.value })} />
              </Form.Group>
            )}
            {planned.has(index) && <div className="small text-success mb-2">Prévue.</div>}
          </div>
        );
      })}
    </AppModal>
  );
}
