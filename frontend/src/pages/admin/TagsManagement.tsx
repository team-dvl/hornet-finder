import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { ReferentialTable, type ReferentialColumn } from '../../components/admin';
import {
  downloadTagSheet, fetchAdminTagQr, fetchAdminTags, fetchTagKeyUsage, revokeTag, TagError,
  type AdminTag, type AdminTagUser, type PrintableTag, type TagKeyUsage, type TagStatus,
} from '../../utils/tagsApi';

const STATUS_LABELS: Record<TagStatus, { label: string; bg: string }> = {
  free: { label: 'Libre', bg: 'info' },
  associated: { label: 'Associé', bg: 'success' },
  revoked: { label: 'Révoqué', bg: 'secondary' },
};

const KEY_STATES: Record<TagKeyUsage['state'], { label: string; bg: string }> = {
  active: { label: 'active', bg: 'success' },
  configured: { label: 'configurée', bg: 'info' },
  retired: { label: 'retirée', bg: 'danger' },
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-BE', { dateStyle: 'short' }) : '—';

const errorMessage = (e: unknown) => (e instanceof TagError ? e.message : String(e));

function Who({ user, at }: { user: AdminTagUser | null; at: string | null }) {
  if (!at) return <span className="text-muted">—</span>;
  return (
    <span className="small">
      {formatDate(at)}
      {user && <span className="text-muted d-block">{user.display_name}</span>}
    </span>
  );
}

/**
 * Management tab of the QR Codes (admin only): usage of each signing key
 * (before retiring one), every QR Code with its state, reprinting and
 * revocation.
 */
export default function TagsManagement() {
  const [keys, setKeys] = useState<TagKeyUsage[] | null>(null);
  const [rows, setRows] = useState<AdminTag[] | null>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<TagStatus | ''>('');
  const [query, setQuery] = useState('');
  const [keyIndex, setKeyIndex] = useState<number | ''>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<PrintableTag | null>(null);
  const [toRevoke, setToRevoke] = useState<AdminTag | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadKeys = useCallback(() => {
    fetchTagKeyUsage().then(setKeys).catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  useEffect(loadKeys, [loadKeys]);

  useEffect(() => {
    let cancelled = false;
    // Debounced for the search field; immediate for the selects
    const timer = window.setTimeout(() => {
      fetchAdminTags({ status, q: query, key_index: keyIndex })
        .then((page) => {
          if (cancelled) return;
          setRows(page.results);
          setCount(page.count);
        })
        .catch((e: unknown) => { if (!cancelled) setError(errorMessage(e)); });
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, query, keyIndex]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchAdminTags({ status, q: query, key_index: keyIndex, offset: rows?.length ?? 0 });
      setRows((previous) => [...(previous ?? []), ...page.results]);
      setCount(page.count);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const showQr = async (tag: AdminTag) => {
    try {
      setQr(await fetchAdminTagQr(tag.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const downloadQr = async (tag: PrintableTag) => {
    setDownloading(true);
    try {
      await downloadTagSheet([tag.value]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleRevoke = async () => {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      const updated = await revokeTag(toRevoke.id);
      setRows((previous) => previous?.map((row) => (row.id === updated.id ? updated : row)) ?? null);
      setToRevoke(null);
      loadKeys();
    } catch (e) {
      setError(errorMessage(e));
      setToRevoke(null);
    } finally {
      setRevoking(false);
    }
  };

  const columns: ReferentialColumn<AdminTag>[] = [
    { key: 'code', header: 'Code', render: (tag) => <code>{tag.short}</code> },
    {
      key: 'status',
      header: 'Statut',
      render: (tag) => <Badge bg={STATUS_LABELS[tag.status].bg}>{STATUS_LABELS[tag.status].label}</Badge>,
    },
    {
      key: 'trap',
      header: 'Piège',
      render: (tag) => (tag.trap
        ? <span className="small">n° {tag.trap.id}{tag.trap.address && ` · ${tag.trap.address}`}</span>
        : <span className="text-muted">—</span>),
    },
    { key: 'key', header: 'Clé', secondary: true, render: (tag) => tag.key_index },
    { key: 'generated', header: 'Généré', secondary: true, render: (tag) => <Who user={tag.generated_by} at={tag.generated_at} /> },
    { key: 'associated', header: 'Associé', secondary: true, render: (tag) => <Who user={tag.associated_by} at={tag.associated_at} /> },
    { key: 'revoked', header: 'Révoqué', secondary: true, render: (tag) => <Who user={tag.revoked_by} at={tag.revoked_at} /> },
    {
      key: 'actions',
      header: '',
      render: (tag) => (
        <span className="text-nowrap">
          <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => void showQr(tag)}>
            <i className="bi bi-qr-code" aria-hidden="true" /> Voir
          </Button>
          {tag.status !== 'revoked' && (
            <Button variant="outline-danger" size="sm" onClick={() => setToRevoke(tag)}>
              <i className="bi bi-x-octagon" aria-hidden="true" /> Révoquer
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <p className="text-muted">
        Tous les QR Codes générés, leur piège et leur état. Un QR Code révoqué ne peut plus être scanné.
      </p>

      {error && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

      <h3 className="h5 mt-4">Clés de signature</h3>
      <p className="text-muted small mb-2">
        Retirer une clé de la configuration (<code>TAG_HMAC_KEYS</code>) invalide d'un coup tous les QR Codes
        qu'elle a signés : vérifiez ici combien sont encore en service.
      </p>
      {keys === null ? (
        <Spinner animation="border" size="sm" />
      ) : (
        <Table size="sm" className="align-middle" style={{ maxWidth: 560 }}>
          <thead>
            <tr><th>Index</th><th>État</th><th className="text-end">Associés</th><th className="text-end">Libres</th><th className="text-end">Révoqués</th></tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.index}>
                <td>{key.index}</td>
                <td><Badge bg={KEY_STATES[key.state].bg}>{KEY_STATES[key.state].label}</Badge></td>
                <td className="text-end">{key.associated}</td>
                <td className="text-end">{key.free}</td>
                <td className="text-end">{key.revoked}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h3 className="h5 mt-4">QR Codes{rows !== null && ` (${count})`}</h3>
      <Row className="g-2 mb-3">
        <Col xs={12} md={5}>
          <Form.Control
            type="search"
            placeholder="Code, n° ou adresse du piège"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Col>
        <Col xs={6} md={4}>
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value as TagStatus | '')}>
            <option value="">Tous les statuts</option>
            <option value="free">Libres</option>
            <option value="associated">Associés</option>
            <option value="revoked">Révoqués</option>
          </Form.Select>
        </Col>
        <Col xs={6} md={3}>
          <Form.Select
            value={keyIndex}
            onChange={(e) => setKeyIndex(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Toutes les clés</option>
            {(keys ?? []).map((key) => <option key={key.index} value={key.index}>Clé {key.index}</option>)}
          </Form.Select>
        </Col>
      </Row>

      {rows === null ? (
        <Spinner animation="border" size="sm" />
      ) : (
        <>
          <ReferentialTable rows={rows} columns={columns} rowKey={(tag) => tag.id} emptyMessage="Aucun QR Code." />
          {rows.length < count && (
            <div className="text-center">
              <Button variant="outline-secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Chargement…' : `Afficher la suite (${count - rows.length})`}
              </Button>
            </div>
          )}
        </>
      )}

      {qr && (
        <Modal show onHide={() => setQr(null)} centered size="sm">
          <Modal.Header closeButton>
            <Modal.Title className="h6">QR Code <code>{qr.short}</code></Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            <img src={qr.qr_svg} alt={`QR Code ${qr.short}`} className="w-100" />
            <div className="small text-muted text-break mt-2">{qr.url}</div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-primary" size="sm" onClick={() => void downloadQr(qr)} disabled={downloading}>
              <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
              {downloading ? 'Préparation…' : 'PDF'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {toRevoke && (
        <Modal show onHide={() => setToRevoke(null)} centered>
          <Modal.Header closeButton>
            <Modal.Title className="h5">Révoquer le QR Code <code>{toRevoke.short}</code> ?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {toRevoke.trap
              ? <>Il est collé sur le piège n° {toRevoke.trap.id}. Une fois révoqué, le scanner n'ouvrira plus ce piège : il faudra en coller un nouveau.</>
              : <>Ce QR Code libre ne pourra plus être associé à un piège.</>}
            {' '}Cette action est définitive.
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setToRevoke(null)} disabled={revoking}>Annuler</Button>
            <Button variant="danger" onClick={() => void handleRevoke()} disabled={revoking}>
              {revoking ? 'Révocation…' : 'Révoquer'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
