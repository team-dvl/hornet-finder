import { useEffect, useState } from 'react';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { ConfirmDialog, IconButton } from '../ui';
import {
  answerInvitation, fetchMyInvitations, inviteErrorOf, type GroupInvitation,
} from '../../utils/invitationsApi';

type Feedback = { variant: 'success' | 'danger'; text: string };

// Renewing the token unmounts the page (App shows its sign-in screen
// meanwhile): the confirmation waits here for the page to come back.
const JOINED_KEY = 'hornet-invitation-joined';

function keepJoinedMessage(text: string): void {
  try { sessionStorage.setItem(JOINED_KEY, text); } catch { /* storage unavailable: no message */ }
}

function joinedFeedback(): Feedback | null {
  try {
    const text = sessionStorage.getItem(JOINED_KEY);
    return text ? { variant: 'success', text } : null;
  } catch {
    return null;
  }
}

function forgetJoinedMessage(): void {
  try { sessionStorage.removeItem(JOINED_KEY); } catch { /* nothing kept */ }
}

/**
 * Invitations to a beekeeper group waiting for the signed-in user's answer.
 * Accepting adds them to the Keycloak group; the token is then renewed so the
 * new group and its role apply at once.
 */
export default function PendingInvitations() {
  const auth = useAuth();
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(joinedFeedback);
  const [declining, setDeclining] = useState<GroupInvitation | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);

  useEffect(forgetJoinedMessage, []);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    // Not worth an error on the landing page: the invitations show at the next visit
    fetchMyInvitations()
      .then((list) => { if (!cancelled) setInvitations(list); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [auth.isAuthenticated]);

  const remove = (id: number) => setInvitations((list) => list.filter((invitation) => invitation.id !== id));

  const handleAccept = async (invitation: GroupInvitation) => {
    setBusyId(invitation.id);
    setFeedback(null);
    try {
      await answerInvitation(invitation.id, true);
      remove(invitation.id);
      keepJoinedMessage(`Vous avez rejoint ${invitation.group_name}.`);
      // A new token carries the group and its role; without it they would
      // only apply at the next automatic renewal, up to a few hours later
      await auth.signinSilent().catch(() => undefined);
    } catch (error) {
      setFeedback({ variant: 'danger', text: inviteErrorOf(error).detail });
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async () => {
    if (!declining) return;
    setBusyId(declining.id);
    setDeclineError(null);
    try {
      await answerInvitation(declining.id, false);
      remove(declining.id);
      setDeclining(null);
    } catch (error) {
      setDeclineError(inviteErrorOf(error).detail);
    } finally {
      setBusyId(null);
    }
  };

  if (invitations.length === 0 && !feedback) return null;

  return (
    <div className="mb-3">
      {invitations.map((invitation) => (
        <Card key={invitation.id} border="primary" className="mb-2">
          <Card.Body className="d-flex flex-wrap align-items-center column-gap-2 row-gap-1 p-2">
            <i className="bi bi-envelope-open fs-4 text-primary flex-shrink-0" aria-hidden="true" />
            <div className="flex-grow-1 min-w-0 invitation-text">
              <div className="fw-semibold text-truncate">{invitation.group_name}</div>
              <div className="small text-muted text-truncate">
                {invitation.invited_by_name
                  ? `Invitation de ${invitation.invited_by_name}`
                  : 'Invitation à rejoindre ce groupe'}
              </div>
            </div>
            <div className="d-flex gap-1 flex-shrink-0 ms-auto">
              <Button
                variant="primary"
                disabled={busyId !== null}
                onClick={() => void handleAccept(invitation)}
              >
                {busyId === invitation.id
                  ? <Spinner animation="border" size="sm" className="me-2" />
                  : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
                Rejoindre
              </Button>
              <IconButton
                variant="outline-secondary"
                icon="x-lg"
                label="Refuser"
                disabled={busyId !== null}
                onClick={() => { setDeclineError(null); setDeclining(invitation); }}
              />
            </div>
          </Card.Body>
        </Card>
      ))}

      {feedback && (
        <Alert variant={feedback.variant} dismissible onClose={() => setFeedback(null)} className="mb-0">
          {feedback.text}
        </Alert>
      )}

      <ConfirmDialog
        show={declining !== null}
        onHide={() => setDeclining(null)}
        onConfirm={() => void handleDecline()}
        title="Refuser l'invitation ?"
        message={declining ? `Vous ne rejoindrez pas ${declining.group_name}.` : undefined}
        confirmLabel="Refuser"
        confirmIcon="x-lg"
        variant="warning"
        busy={busyId !== null}
        error={declineError}
      />
    </div>
  );
}
