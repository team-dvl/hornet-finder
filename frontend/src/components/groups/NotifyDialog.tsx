import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal, ConfirmDialog } from '../ui';
import { sendNotification, pushErrorOf, type SentSummary } from '../../utils/pushApi';

const TITLE_MAX = 60;
const BODY_MAX = 200;

interface NotifyDialogProps {
  show: boolean;
  onHide: () => void;
  groupPath: string;
  groupName: string;
  /** The member to write to; the whole group when absent */
  member?: { guid: string; name: string | null };
  onSent: (summary: SentSummary) => void;
}

/**
 * Writes a push notification to a group, or to one of its members: the text
 * first, then a confirmation that replaces it (one dialog at a time). What was
 * typed survives a cancelled confirmation.
 */
export default function NotifyDialog({ show, onHide, groupPath, groupName, member, onSent }: NotifyDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closing the dialog drops what was typed (a stray tap outside does not close it: `locked`)
  const close = () => {
    setTitle('');
    setBody('');
    setError(null);
    onHide();
  };

  const target = member ? (member.name ?? 'ce compte') : groupName;
  const valid = title.trim() !== '' && body.trim() !== '';

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await sendNotification({
        group_path: groupPath, title: title.trim(), body: body.trim(), ...(member ? { guid: member.guid } : {}),
      });
      setConfirming(false);
      setTitle('');
      setBody('');
      onSent(summary);
    } catch (failure) {
      setError(pushErrorOf(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppModal
        show={show && !confirming}
        onHide={close}
        locked
        title={member ? `Notifier ${target}` : 'Notifier le groupe'}
        onSubmit={(event) => { event.preventDefault(); if (valid) { setError(null); setConfirming(true); } }}
        footer={(
          <Button type="submit" variant="primary" disabled={!valid}>
            <i className="bi bi-send me-2" aria-hidden="true" />Envoyer
          </Button>
        )}
      >
        <Form.Group className="mb-3" controlId="notify-title">
          <Form.Label>
            Titre
            <HelpTip id="notify-help" title="Notification">
              Le message s'affiche sur l'écran des appareils abonnés, même application fermée, et se lit sans
              déverrouiller le téléphone : n'y mettez rien de confidentiel. Une personne sans appareil abonné ne le
              reçoit pas.
            </HelpTip>
          </Form.Label>
          <Form.Control value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} />
        </Form.Group>
        <Form.Group controlId="notify-body">
          <Form.Label>Message</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={body}
            maxLength={BODY_MAX}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="text-end small text-muted mt-1">{body.length} / {BODY_MAX}</div>
        </Form.Group>
        {busy && <Spinner animation="border" size="sm" />}
        {error && !confirming && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
      </AppModal>

      <ConfirmDialog
        show={show && confirming}
        onHide={() => setConfirming(false)}
        onConfirm={() => void send()}
        title={member ? `Envoyer à ${target} ?` : `Envoyer à tout le groupe ${target} ?`}
        message={<><strong>{title.trim()}</strong><br />{body.trim()}</>}
        confirmLabel="Envoyer"
        confirmIcon="send"
        variant="primary"
        busy={busy}
        error={error}
      />
    </>
  );
}
