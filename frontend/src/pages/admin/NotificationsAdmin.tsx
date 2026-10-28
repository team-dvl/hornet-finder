import { useEffect, useState } from 'react';
import { Alert, Badge, Container, ListGroup, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { IconButton } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { fetchDeliveries, pushErrorOf, type PushDeliveryRow } from '../../utils/pushApi';

/** Badge of the push service's answer: 201 accepted, 404/410 device gone, 0 unreachable, 1 held back by the platform. */
function StatusBadge({ row }: { row: PushDeliveryRow }) {
  if (row.status === null) return <Badge bg="secondary">en cours</Badge>;
  if (row.status === 201) return <Badge bg="success">accepté</Badge>;
  if (row.status === 1) return <Badge bg="secondary">suspendu</Badge>;
  if (row.status === 404 || row.status === 410) return <Badge bg="warning" text="dark">appareil retiré</Badge>;
  return <Badge bg="danger">{row.status === 0 ? 'injoignable' : `erreur ${row.status}`}</Badge>;
}

/**
 * Last notification deliveries, device by device, to compare how the
 * platforms behave: whether the push service accepted the message, and how
 * long the device took to show it (the receipt its service worker sends).
 */
export default function NotificationsAdmin() {
  const [rows, setRows] = useState<PushDeliveryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the refresh button
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchDeliveries()
      .then((list) => { if (!cancelled) { setRows(list); setError(null); } })
      .catch((failure) => { if (!cancelled) setError(pushErrorOf(failure)); });
    return () => { cancelled = true; };
  }, [reload]);

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader
          title="Notifications"
          help="Les dernières notifications envoyées, appareil par appareil."
        />

        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="h5 mb-0 d-flex align-items-center">
            Envois
            <HelpTip id="deliveries-help" title="Lecture">
              « Accepté » veut dire que le service de notification du navigateur ou du téléphone a pris le message,
              pas que la personne l'a vu. Le délai est celui de l'affichage sur l'appareil, mesuré quand son
              application le confirme : sans délai, l'appareil n'a rien confirmé (hors ligne, ou notification non affichée).
            </HelpTip>
          </h2>
          <IconButton variant="outline-secondary" icon="arrow-clockwise" label="Actualiser" showLabel="never"
            onClick={() => setReload((count) => count + 1)} />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {!rows && !error && <Spinner animation="border" role="status" />}
        {rows?.length === 0 && <p className="text-muted">Aucune notification envoyée.</p>}

        <ListGroup>
          {rows?.map((row) => (
            <ListGroup.Item key={row.id} className="py-2 px-2">
              <div className="d-flex align-items-center gap-2">
                <div className="flex-grow-1 min-w-0">
                  <div className="text-truncate fw-semibold">{row.title}</div>
                  <div className="small text-muted text-truncate">
                    {row.device || 'Appareil'}{row.installed ? ' · installée' : ''} · {formatDateTime(row.created_at)}
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <StatusBadge row={row} />
                  <div className="small text-muted mt-1">
                    {row.seconds_to_receive !== null ? `${row.seconds_to_receive} s` : '—'}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Container>
    </PageLayout>
  );
}
