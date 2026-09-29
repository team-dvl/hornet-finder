import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Container, Form, ListGroup, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { ConfirmDialog, IconButton } from '../../components/ui';
import { formatDate, formatDateTime, formatShortDateTime } from '../../utils/format';
import {
  cancelInvitation, fetchInvitable, fetchSentInvitations, inviteErrorOf, remindInvitation, sendInvitation,
  type GroupInvitation, type InvitableGroup, type InviteError, type LookupState,
} from '../../utils/invitationsApi';

type Feedback = { variant: 'success' | 'danger'; text: string };

function isLocked(lookup: LookupState | null): boolean {
  return Boolean(lookup?.locked_until && new Date(lookup.locked_until) > new Date());
}

/** When the next reminder may go, or null when it may go now. */
function reminderWait(invitation: GroupInvitation): string | null {
  const next = invitation.next_reminder_at;
  return next && new Date(next) > new Date() ? next : null;
}

/** The error of a refused invitation, with what it costs when it was a failed lookup. */
function describe(error: InviteError): string {
  if (error.lookup?.locked_until) {
    return `${error.detail} Nouvel essai possible le ${formatDateTime(error.lookup.locked_until)}.`;
  }
  if (error.code === 'no_active_user' && error.lookup) {
    const left = error.lookup.remaining_attempts;
    return `${error.detail} Encore ${left} essai${left > 1 ? 's' : ''} avant une pause de 24 heures.`;
  }
  return error.detail;
}

/**
 * Invitations to a beekeeper group, for the group's administrators and the
 * platform admins: invite an existing account by its full email address, and
 * follow or withdraw the pending invitations.
 */
export default function InvitationsAdmin() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groups, setGroups] = useState<InvitableGroup[]>([]);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);

  const [groupPath, setGroupPath] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [listFeedback, setListFeedback] = useState<Feedback | null>(null);

  const [withdrawing, setWithdrawing] = useState<GroupInvitation | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchInvitable(), fetchSentInvitations()])
      .then(([invitable, sent]) => {
        if (cancelled) return;
        setGroups(invitable.groups);
        setLookup(invitable.lookup);
        setGroupPath(invitable.groups[0]?.path ?? '');
        setInvitations(sent);
      })
      .catch((error) => { if (!cancelled) setLoadError(inviteErrorOf(error).detail); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const locked = isLocked(lookup);
  const severalGroups = groups.length > 1;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !groupPath || locked) return;
    setSending(true);
    setFeedback(null);
    try {
      const invitation = await sendInvitation(groupPath, email.trim());
      setInvitations((list) => [invitation, ...list]);
      setEmail('');
      const who = invitation.invitee_name ? ` à ${invitation.invitee_name}` : '';
      setFeedback(invitation.notified === false
        ? { variant: 'danger', text: `Invitation enregistrée${who}, mais l'email n'a pas pu partir : prévenez la personne.` }
        : { variant: 'success', text: `Invitation envoyée${who}.` });
    } catch (error) {
      const refused = inviteErrorOf(error);
      if (refused.lookup) setLookup(refused.lookup);
      setFeedback({ variant: 'danger', text: describe(refused) });
    } finally {
      setSending(false);
    }
  };

  const handleRemind = async (invitation: GroupInvitation) => {
    setRemindingId(invitation.id);
    setListFeedback(null);
    try {
      const updated = await remindInvitation(invitation.id);
      setInvitations((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      const who = updated.invitee_name ? ` à ${updated.invitee_name}` : '';
      setListFeedback({ variant: 'success', text: `Rappel envoyé${who}.` });
    } catch (error) {
      setListFeedback({ variant: 'danger', text: inviteErrorOf(error).detail });
    } finally {
      setRemindingId(null);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawing) return;
    setWithdrawBusy(true);
    setWithdrawError(null);
    try {
      await cancelInvitation(withdrawing.id);
      setInvitations((list) => list.filter((invitation) => invitation.id !== withdrawing.id));
      setWithdrawing(null);
    } catch (error) {
      setWithdrawError(inviteErrorOf(error).detail);
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Invitations" help="Invitez un apiculteur à rejoindre votre association." />

        {loading && <Spinner animation="border" role="status" />}
        {loadError && <Alert variant="danger">{loadError}</Alert>}
        {!loading && !loadError && groups.length === 0 && (
          <p className="text-muted">Vous n'administrez aucun groupe d'apiculteurs.</p>
        )}

        {groups.length > 0 && (
          <>
            <section>
              <h2 className="h5 d-flex align-items-center mb-3">
                Inviter
                <HelpTip id="invite-help" title="Inviter un apiculteur">
                  La personne doit déjà avoir un compte actif, créé avec cette adresse. Tapez l'adresse
                  complète : aucune suggestion n'est proposée. Elle reçoit un email et voit l'invitation sur la
                  page d'accueil de l'application, où elle l'accepte ou la refuse ; sans réponse, l'invitation expire après 30 jours.
                  Depuis la liste des invitations en attente, un rappel peut lui être envoyé une fois par 24 heures.
                  Après 10 adresses sans compte en 24 heures, les invitations sont suspendues pendant 24 heures.
                </HelpTip>
              </h2>

              <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
                {severalGroups ? (
                  <Form.Select
                    className="mb-2"
                    aria-label="Groupe"
                    value={groupPath}
                    onChange={(event) => setGroupPath(event.target.value)}
                  >
                    {groups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
                  </Form.Select>
                ) : (
                  <div className="fw-semibold text-truncate mb-2">
                    <i className="bi bi-people me-2" aria-hidden="true" />
                    {groups[0].name}
                  </div>
                )}
                <div className="d-flex flex-wrap gap-2">
                  <Form.Control
                    type="email"
                    className="invite-email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Adresse email de la personne invitée"
                    placeholder="adresse@exemple.org"
                    value={email}
                    disabled={locked}
                    onChange={(event) => { setEmail(event.target.value); setFeedback(null); }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-shrink-0"
                    disabled={sending || locked || !email.trim()}
                  >
                    {sending
                      ? <Spinner animation="border" size="sm" className="me-2" />
                      : <i className="bi bi-envelope-plus me-2" aria-hidden="true" />}
                    Inviter
                  </Button>
                </div>
              </Form>

              {feedback && <Alert variant={feedback.variant} className="mt-3 mb-0">{feedback.text}</Alert>}
              {locked && !feedback && lookup?.locked_until && (
                <Alert variant="danger" className="mt-3 mb-0">
                  Trop d'adresses sans compte : invitations suspendues jusqu'au {formatDateTime(lookup.locked_until)}.
                </Alert>
              )}
            </section>

            <section className="mt-4">
              <h2 className="h5 mb-3">En attente</h2>
              {listFeedback && (
                <Alert variant={listFeedback.variant} dismissible onClose={() => setListFeedback(null)}>
                  {listFeedback.text}
                </Alert>
              )}
              {invitations.length === 0 ? (
                <p className="text-muted mb-0">Aucune invitation en attente.</p>
              ) : (
                <ListGroup>
                  {invitations.map((invitation) => {
                    const wait = reminderWait(invitation);
                    return (
                      <ListGroup.Item key={invitation.id} className="d-flex align-items-center gap-2 py-2 px-2">
                        <div className="flex-grow-1 min-w-0">
                          <div className="text-truncate">
                            {invitation.invitee_name ?? <span className="text-muted">Compte sans nom</span>}
                          </div>
                          <div className="small text-muted text-truncate">
                            {severalGroups && `${invitation.group_name} · `}
                            expire le {formatDate(invitation.expires_at)}
                          </div>
                          {wait && (
                            <div className="small text-muted text-truncate">
                              <i className="bi bi-bell-slash me-1" aria-hidden="true" />
                              rappel dès le {formatShortDateTime(wait)}
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-1 flex-shrink-0">
                          <IconButton
                            variant="outline-primary"
                            icon="bell"
                            label={wait ? `Rappel possible le ${formatDateTime(wait)}` : 'Envoyer un rappel'}
                            showLabel="never"
                            disabled={Boolean(wait) || remindingId !== null}
                            onClick={() => void handleRemind(invitation)}
                          />
                          <IconButton
                            variant="outline-danger"
                            icon="x-lg"
                            label="Retirer l'invitation"
                            showLabel="never"
                            onClick={() => { setWithdrawError(null); setWithdrawing(invitation); }}
                          />
                        </div>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              )}
            </section>
          </>
        )}

        <ConfirmDialog
          show={withdrawing !== null}
          onHide={() => setWithdrawing(null)}
          onConfirm={() => void handleWithdraw()}
          title="Retirer l'invitation ?"
          message={withdrawing
            ? `${withdrawing.invitee_name ?? 'Cette personne'} ne pourra plus rejoindre ${withdrawing.group_name} avec cette invitation.`
            : undefined}
          confirmLabel="Retirer"
          confirmIcon="x-lg"
          busy={withdrawBusy}
          error={withdrawError}
        />
      </Container>
    </PageLayout>
  );
}
