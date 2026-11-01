import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Badge, Card, Container, ListGroup, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { IconButton } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { fetchDashboard, type DeliveryWindow, type PlatformDashboardData } from '../../utils/platformApi';
import { pauseSummary } from '../../utils/platformState';
import { pushErrorOf } from '../../utils/pushApi';

/** A label and its value on one line; the value wraps under a long label instead of overflowing. */
function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ListGroup.Item className="d-flex flex-wrap justify-content-between align-items-center gap-2 bg-transparent">
      <span>{label}</span>
      <span className="text-end">{children}</span>
    </ListGroup.Item>
  );
}

/** What became of the deliveries of a period: accepted of all, then the exceptions, under the period. */
function WindowRow({ label, data }: { label: string; data: DeliveryWindow }) {
  return (
    <ListGroup.Item className="bg-transparent">
      <div>{label}</div>
      {data.deliveries === 0 ? (
        <div className="text-muted">aucun envoi</div>
      ) : (
        <>
          <div className="d-flex flex-wrap align-items-center gap-1">
            <span><strong>{data.accepted}</strong><span className="text-muted"> / {data.deliveries} acceptés</span></span>
            {data.gone > 0 && <Badge bg="warning" text="dark">{data.gone} retirés</Badge>}
            {data.failed > 0 && <Badge bg="danger">{data.failed} en erreur</Badge>}
            {data.paused > 0 && <Badge bg="secondary">{data.paused} suspendus</Badge>}
            {data.waiting > 0 && <Badge bg="secondary">{data.waiting} en cours</Badge>}
          </div>
          {data.median_seconds !== null && (
            <div className="small text-muted">affichage : {data.median_seconds} s (médiane)</div>
          )}
        </>
      )}
    </ListGroup.Item>
  );
}

/** A row opening a sub-page: icon, label, what it holds right now, chevron. */
function MenuRow({ to, icon, label, detail, warn }: {
  to: string; icon: string; label: string; detail?: string; warn?: boolean;
}) {
  return (
    <ListGroup.Item action as={Link} to={to} className="d-flex align-items-center gap-2">
      <i className={`bi ${icon} fs-5`} aria-hidden="true" />
      <span className="flex-grow-1">
        <span className="d-block">{label}</span>
        {detail && <span className={`d-block small ${warn ? 'text-warning-emphasis' : 'text-muted'}`}>{detail}</span>}
      </span>
      <i className="bi bi-chevron-right text-muted" aria-hidden="true" />
    </ListGroup.Item>
  );
}

/**
 * Hub of the platform admins: the sub-pages (notification switches, audit
 * trail) and, read only, the state of the devices, of the sendings and of the
 * scheduler.
 */
export default function PlatformDashboard() {
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchDashboard()
      .then((result) => { setData(result); setError(null); })
      .catch((failure) => setError(pushErrorOf(failure)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const kinds = data?.notifications.kinds ?? [];

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Plateforme" help="Les notifications, le journal d'audit et l'état de la plateforme." />

        {error && <Alert variant="danger">{error}</Alert>}
        {!data && !error && <Spinner animation="border" role="status" />}

        {data && (
          <>
            <ListGroup className="mb-4">
              <MenuRow
                to="/admin/platform/notifications"
                icon="bi-bell"
                label="Notifications"
                detail={pauseSummary(kinds)}
                warn={kinds.some((kind) => kind.paused)}
              />
              <MenuRow to="/admin/audit" icon="bi-clock-history" label="Journal d'audit" />
            </ListGroup>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 text-uppercase text-muted mb-0">État</h2>
              <IconButton variant="outline-secondary" icon="arrow-clockwise" label="Actualiser" showLabel="never"
                onClick={load} />
            </div>

            <h3 className="h6 mb-2">Appareils</h3>
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
              <h3 className="h6 mb-0 d-flex align-items-center">
                Envois
                <HelpTip id="platform-deliveries-help" title="Envois" doc="admin#platform">
                  Le résultat des messages partis : « acceptés » veut dire que le service de notification du
                  navigateur ou du téléphone les a pris en charge, pas que la personne les a vus ; « retirés », que
                  l&apos;appareil s&apos;est désabonné ; « en erreur », que le service n&apos;a pas répondu.
                  Tous les messages comptent, écrits par une personne, automatiques ou essais.
                </HelpTip>
              </h3>
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

            <h3 className="h6 mb-2 d-flex align-items-center">
              Planificateur
              <HelpTip id="platform-scheduler-help" title="Planificateur" doc="admin#platform">
                Le service qui décide d&apos;envoyer, toutes les 10 minutes : rappels de pièges, alertes de nids,
                fin de saison et ménage. Les envois ci-dessus sont ce qui en résulte, et ce que les personnes
                écrivent à la main. Un planificateur à l&apos;arrêt coupe les envois automatiques, pas les
                messages écrits ; sans passage depuis {data.scheduler.stale_after_minutes} minutes, il est signalé
                en retard (<code>./logs.sh scheduler</code>).
              </HelpTip>
            </h3>
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
    </PageLayout>
  );
}
