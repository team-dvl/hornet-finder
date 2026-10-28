import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Badge, Card, Container, ListGroup, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { ConfirmDialog, IconButton, Switch } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import {
  fetchDashboard, setPausedKinds,
  type DeliveryWindow, type PlatformDashboardData,
} from '../../utils/platformApi';
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

/** A label and its value on one line; the value wraps under a long label instead of overflowing. */
function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ListGroup.Item className="d-flex flex-wrap justify-content-between align-items-center gap-2 bg-transparent">
      <span>{label}</span>
      <span className="text-end">{children}</span>
    </ListGroup.Item>
  );
}

/** What became of the deliveries of a period: accepted of all, then the exceptions. */
function WindowRow({ label, data }: { label: string; data: DeliveryWindow }) {
  if (data.deliveries === 0) {
    return <StatRow label={label}><span className="text-muted">aucun envoi</span></StatRow>;
  }
  return (
    <StatRow label={label}>
      <strong>{data.accepted}</strong>
      <span className="text-muted"> / {data.deliveries} acceptés</span>
      {data.gone > 0 && <Badge bg="warning" text="dark" className="ms-1">{data.gone} retirés</Badge>}
      {data.failed > 0 && <Badge bg="danger" className="ms-1">{data.failed} en erreur</Badge>}
      {data.paused > 0 && <Badge bg="secondary" className="ms-1">{data.paused} suspendus</Badge>}
      {data.waiting > 0 && <Badge bg="secondary" className="ms-1">{data.waiting} en cours</Badge>}
      {data.median_seconds !== null && (
        <span className="d-block small text-muted">affichage : {data.median_seconds} s (médiane)</span>
      )}
    </StatRow>
  );
}

/**
 * Dashboard of the platform admins: the switches that hold back kinds of
 * notifications for everyone (the global one flips all of them), and the state
 * of the notifications, the devices and the scheduler.
 */
export default function PlatformDashboard() {
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kinds about to be held back, waiting for the admin's confirmation
  const [confirming, setConfirming] = useState<NotificationKind[] | null>(null);

  const load = useCallback(() => {
    fetchDashboard()
      .then((result) => { setData(result); setError(null); })
      .catch((failure) => setError(pushErrorOf(failure)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const kinds = data?.notifications.kinds ?? [];
  const paused = kinds.filter((kind) => kind.paused).map((kind) => kind.id);

  const apply = async (next: NotificationKind[]) => {
    setBusy(true);
    setError(null);
    try {
      const notifications = await setPausedKinds(next);
      setData((current) => (current ? { ...current, notifications } : current));
    } catch (failure) {
      setError(pushErrorOf(failure));
    } finally {
      setBusy(false);
    }
  };

  /** Resuming is immediate; holding back asks first, as it silences people. */
  const change = (next: NotificationKind[]) => {
    const added = next.filter((kind) => !paused.includes(kind));
    if (added.length > 0) setConfirming(next);
    else void apply(next);
  };

  const toggleKind = (id: NotificationKind, active: boolean) =>
    change(active ? paused.filter((kind) => kind !== id) : [...paused, id]);

  // The global switch is on when nothing is held back; from any other state it resumes everything
  const toggleAll = (active: boolean) => change(active ? [] : kinds.map((kind) => kind.id));

  const notifications = data?.notifications;
  const everything = confirming !== null && confirming.length === kinds.length;
  const confirmedLabels = (confirming ?? []).filter((id) => !paused.includes(id))
    .map((id) => kinds.find((kind) => kind.id === id)?.label).join(', ');
  const state = paused.length === 0 ? null
    : paused.length === kinds.length ? 'Toutes suspendues' : `${paused.length} sur ${kinds.length} suspendues`;
  const globalDetail = [state, notifications?.updated_at ? `modifié le ${formatDateTime(notifications.updated_at)}` : null]
    .filter(Boolean).join(' · ') || undefined;

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Plateforme" help="L'état de la plateforme et les notifications pour tout le monde." />

        {error && <Alert variant="danger">{error}</Alert>}
        {!data && !error && <Spinner animation="border" role="status" />}

        {data && notifications && (
          <>
            {!notifications.configured && (
              <Alert variant="secondary">
                Les notifications ne sont pas configurées sur ce serveur (clés VAPID absentes).
              </Alert>
            )}

            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 text-uppercase text-muted mb-0 d-flex align-items-center">
                Notifications
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

            <h2 className="h6 text-uppercase text-muted mb-2">Appareils</h2>
            <Card className="mb-4">
              <ListGroup variant="flush">
                <StatRow label="Appareils abonnés"><strong>{data.devices.total}</strong></StatRow>
                <StatRow label="Personnes">
                  <strong>{data.devices.people}</strong>
                  <span className="text-muted"> sur {data.devices.users}</span>
                </StatRow>
                {data.devices.by_device.map((row) => (
                  <StatRow key={row.device} label={row.device}>{row.count}</StatRow>
                ))}
              </ListGroup>
            </Card>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 text-uppercase text-muted mb-0">Envois</h2>
              <Link to="/admin/notifications" className="btn btn-outline-secondary">
                <i className="bi bi-list-ul me-1" aria-hidden="true" />
                Détail
              </Link>
            </div>
            <Card className="mb-4">
              <ListGroup variant="flush">
                <WindowRow label="24 dernières heures" data={data.deliveries.day} />
                <WindowRow label="7 derniers jours" data={data.deliveries.week} />
              </ListGroup>
            </Card>

            <h2 className="h6 text-uppercase text-muted mb-2 d-flex align-items-center">
              Planificateur
              <HelpTip id="platform-scheduler-help" title="Planificateur">
                Le service qui envoie les rappels de pièges et les alertes de nids et fait le ménage, toutes les
                10 minutes. Sans passage depuis {data.scheduler.stale_after_minutes} minutes, il est signalé en
                retard : voir ses journaux (<code>./logs.sh scheduler</code>).
              </HelpTip>
            </h2>
            <Card className="mb-4">
              <ListGroup variant="flush">
                <StatRow label="État">
                  {data.scheduler.ok
                    ? <Badge bg="success">en marche</Badge>
                    : <Badge bg="danger">{data.scheduler.last_pass_at ? 'en retard' : 'jamais vu'}</Badge>}
                </StatRow>
                {data.scheduler.last_pass_at && (
                  <StatRow label="Dernier passage">{formatDateTime(data.scheduler.last_pass_at)}</StatRow>
                )}
                {data.waiting.nest_events > 0 && (
                  <StatRow label="Événements de nids en attente"><strong>{data.waiting.nest_events}</strong></StatRow>
                )}
              </ListGroup>
            </Card>
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
