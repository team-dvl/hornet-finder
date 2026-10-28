import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Container, ListGroup, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { ConfirmDialog, IconButton, Switch } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { fetchNotifications, setPausedKinds, type PlatformNotifications } from '../../utils/platformApi';
import { pauseSummary } from '../../utils/platformState';
import { pushErrorOf, type NotificationKind } from '../../utils/pushApi';

const KIND_ICONS: Record<NotificationKind, string> = {
  trap_reading: '🪤',
  trap_refill: '🧪',
  nest_new: '🏴',
  nest_near_apiary: '🍯',
  nest_followup: '📍',
  group_message: '👥',
  platform_message: '📣',
};

/**
 * Platform admins: hold back kinds of notifications for everyone. One switch
 * per kind, and a general one that flips them all (each kind stays settable).
 */
export default function PlatformNotificationsPage() {
  const [data, setData] = useState<PlatformNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kinds about to be held back, waiting for the admin's confirmation
  const [confirming, setConfirming] = useState<NotificationKind[] | null>(null);

  const load = useCallback(() => {
    fetchNotifications()
      .then((result) => { setData(result); setError(null); })
      .catch((failure) => setError(pushErrorOf(failure)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const kinds = data?.kinds ?? [];
  const paused = kinds.filter((kind) => kind.paused).map((kind) => kind.id);

  const apply = async (next: NotificationKind[]) => {
    setBusy(true);
    setError(null);
    try {
      setData(await setPausedKinds(next));
    } catch (failure) {
      setError(pushErrorOf(failure));
    } finally {
      setBusy(false);
    }
  };

  /** Resuming is immediate; holding back asks first, as it silences people. */
  const change = (next: NotificationKind[]) => {
    if (next.some((kind) => !paused.includes(kind))) setConfirming(next);
    else void apply(next);
  };

  const toggleKind = (id: NotificationKind, active: boolean) =>
    change(active ? paused.filter((kind) => kind !== id) : [...paused, id]);

  // The global switch is on when nothing is held back; from any other state it resumes everything
  const toggleAll = (active: boolean) => change(active ? [] : kinds.map((kind) => kind.id));

  const everything = confirming !== null && confirming.length === kinds.length;
  const confirmedLabels = (confirming ?? []).filter((id) => !paused.includes(id))
    .map((id) => kinds.find((kind) => kind.id === id)?.label).join(', ');
  const globalDetail = [
    paused.length > 0 ? pauseSummary(kinds) : null,
    data?.updated_at ? `modifié le ${formatDateTime(data.updated_at)}` : null,
  ].filter(Boolean).join(' · ') || undefined;

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Notifications" help="Suspendre des notifications pour tout le monde." />

        {error && <Alert variant="danger">{error}</Alert>}
        {!data && !error && <Spinner animation="border" role="status" />}

        {data && (
          <>
            {!data.configured && (
              <Alert variant="secondary">
                Les notifications ne sont pas configurées sur ce serveur (clés VAPID absentes).
              </Alert>
            )}

            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 text-uppercase text-muted mb-0 d-flex align-items-center">
                Interrupteurs
                <HelpTip id="platform-notifications-help" title="Suspendre des notifications" doc="admin#platform">
                  Suspendre une sorte la coupe pour tout le monde : les rappels de pièges et les alertes de nids
                  attendent la reprise (les alertes de nids de plus de 48 h sont perdues), les messages de groupe
                  ou de la plateforme sont refusés, ce qui est déjà parti n&apos;est pas rappelé. L&apos;interrupteur
                  général les bascule toutes ; chacune reste réglable.
                </HelpTip>
              </h2>
              <IconButton variant="outline-secondary" icon="arrow-clockwise" label="Actualiser" showLabel="never"
                onClick={load} />
            </div>
            <Card body className="py-0 mb-4">
              <Switch
                id="platform-all"
                icon="🔔"
                label="Toutes les notifications"
                detail={globalDetail}
                checked={paused.length === 0}
                disabled={busy}
                onChange={toggleAll}
              />
              {kinds.map((kind) => (
                <Switch
                  key={kind.id}
                  id={`platform-${kind.id}`}
                  icon={KIND_ICONS[kind.id]}
                  label={kind.label}
                  checked={!kind.paused}
                  disabled={busy}
                  onChange={(active) => toggleKind(kind.id, active)}
                />
              ))}
            </Card>

            <h2 className="h6 text-uppercase text-muted mb-2">Envois</h2>
            <ListGroup className="mb-4">
              <ListGroup.Item action as={Link} to="/admin/notifications" className="d-flex align-items-center gap-2">
                <i className="bi bi-list-ul fs-5" aria-hidden="true" />
                <span className="flex-grow-1">Envois, appareil par appareil</span>
                <i className="bi bi-chevron-right text-muted" aria-hidden="true" />
              </ListGroup.Item>
            </ListGroup>
          </>
        )}
      </Container>

      {confirming && (
        <ConfirmDialog
          show
          onHide={() => setConfirming(null)}
          onConfirm={() => { const next = confirming; setConfirming(null); void apply(next); }}
          title={everything ? 'Suspendre toutes les notifications ?' : 'Suspendre ces notifications ?'}
          message={everything
            ? 'Plus aucune notification ne partira pour personne, sauf les essais. Vous pourrez les reprendre ici à tout moment.'
            : `${confirmedLabels} : plus rien ne partira pour personne. Vous pourrez les reprendre ici à tout moment.`}
          confirmLabel="Suspendre"
          confirmIcon="bell-slash"
          variant="warning"
        />
      )}
    </PageLayout>
  );
}
