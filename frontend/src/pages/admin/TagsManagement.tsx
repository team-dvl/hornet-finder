import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { AppModal, ConfirmDialog } from '../../components/ui';
import { HelpTip } from '../../components/common';
import { SheetPdfButton } from '../../components/tags';
import { Link } from 'react-router-dom';
import { ReferentialTable, type ReferentialColumn } from '../../components/admin';
import {
  fetchAdminTagQr, fetchAdminTagSheetLink, fetchTagSheetLink, fetchAdminTags, fetchTagKeyUsage, revokeTag, TagError,
  taggedObject, type AdminTag, type AdminTagUser, type PrintableTag, type TagKeyUsage, type TagStatus,
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

/** Tags per PDF sheet, see MAX_LISTED in `hornet/tag_views.py` */
const MAX_SHEET = 200;

const formatDate =(value: string | null) =>
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
  /** Ids of the tags picked for a reprint; kept across filters to gather a sheet */
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  const toggle = (id: number, on: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  const selectable = (rows ?? []).filter((tag) => tag.status !== 'revoked');
  const allSelected = selectable.length > 0 && selectable.every((tag) => selected.has(tag.id));

  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    for (const tag of selectable) {
      if (allSelected) next.delete(tag.id);
      else next.add(tag.id);
    }
    return next;
  });

  const selectedIds = [...selected].sort((a, b) => a - b);

  const handleRevoke = async () => {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      const updated = await revokeTag(toRevoke.id);
      setRows((previous) => previous?.map((row) => (row.id === updated.id ? updated : row)) ?? null);
      toggle(updated.id, false);
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
    {
      key: 'select',
      header: (
        <Form.Check
          aria-label="Sélectionner les QR Codes affichés"
          checked={allSelected}
          disabled={selectable.length === 0}
          onChange={toggleAll}
        />
      ),
      // A revoked tag keeps an invisible box, so every code lines up
      render: (tag) => (tag.status === 'revoked' ? <Form.Check className="invisible" aria-hidden="true" tabIndex={-1} disabled /> : (
        <Form.Check
          aria-label={`Sélectionner ${tag.short}`}
          checked={selected.has(tag.id)}
          onChange={(e) => toggle(tag.id, e.target.checked)}
        />
      )),
    },
    {
      key: 'code',
      header: 'Code',
      // On a phone the status goes under the code, to leave room for the object
      render: (tag) => (
        <div className="d-flex flex-column align-items-start gap-1">
          <code>{tag.short}</code>
          <Badge bg={STATUS_LABELS[tag.status].bg} className="d-sm-none">{STATUS_LABELS[tag.status].label}</Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      phoneHidden: true,
      render: (tag) => <Badge bg={STATUS_LABELS[tag.status].bg}>{STATUS_LABELS[tag.status].label}</Badge>,
    },
    {
      key: 'object',
      header: 'Objet',
      main: true,
      render: (tag) => {
        const object = taggedObject(tag);
        return object
          ? (
            <Link to={object.path} className="d-inline-flex align-items-start gap-1 text-decoration-none" title="Ouvrir sa fiche">
              <span className="flex-shrink-0" aria-hidden="true">{object.icon}</span>
              <span>{object.label}</span>
            </Link>
          )
          : <span className="text-muted d-none d-sm-inline">—</span>;
      },
    },
    { key: 'key', header: 'Clef', secondary: true, render: (tag) => tag.key_index },
    { key: 'generated', header: 'Généré', secondary: true, render: (tag) => <Who user={tag.generated_by} at={tag.generated_at} /> },
    { key: 'associated', header: 'Associé', secondary: true, render: (tag) => <Who user={tag.associated_by} at={tag.associated_at} /> },
    { key: 'revoked', header: 'Révoqué', secondary: true, render: (tag) => <Who user={tag.revoked_by} at={tag.revoked_at} /> },
    {
      key: 'actions',
      header: '',
      render: (tag) => (
        <div className="d-flex flex-column gap-1">
          {/* Icons only on a phone, so the column fits without scrolling */}
          <Button variant="outline-secondary" size="sm" className="text-nowrap" title="Voir" aria-label="Voir"
            onClick={() => void showQr(tag)}>
            <i className="bi bi-qr-code" aria-hidden="true" /><span className="d-none d-sm-inline"> Voir</span>
          </Button>
          {tag.status !== 'revoked' && (
            <Button variant="outline-danger" size="sm" className="text-nowrap" title="Révoquer" aria-label="Révoquer"
              onClick={() => setToRevoke(tag)}>
              <i className="bi bi-x-octagon" aria-hidden="true" /><span className="d-none d-sm-inline"> Révoquer</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {error && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

      <h3 className="h5">
        Clefs de signature
        <HelpTip id="help-tag-keys" title="Clefs de signature">
          Retirer une clef de la configuration (<code>TAG_HMAC_KEYS</code>) invalide d'un coup tous les QR Codes
          qu'elle a signés : vérifiez ici combien sont encore en service.
        </HelpTip>
      </h3>
      {keys === null ? (
        <Spinner animation="border" size="sm" />
      ) : (
        <>
          {/* Phone: one line per key, the counts under its name, no table to scroll sideways */}
          <div className="referential-list d-sm-none mb-3">
            {keys.map((key) => (
              <div key={key.index} className="referential-row">
                <div className="referential-main">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold">Clef {key.index}</span>
                    <Badge bg={KEY_STATES[key.state].bg}>{KEY_STATES[key.state].label}</Badge>
                  </div>
                  <div className="small text-muted">
                    {key.associated} associé{key.associated > 1 ? 's' : ''}
                    {' · '}{key.free} libre{key.free > 1 ? 's' : ''}
                    {' · '}{key.revoked} révoqué{key.revoked > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        <Table size="sm" responsive className="align-middle d-none d-sm-table" style={{ maxWidth: 560 }}>
          <thead>
            <tr><th>Clef</th><th>État</th><th className="text-end">Associés</th><th className="text-end">Libres</th><th className="text-end">Révoqués</th></tr>
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
        </>
      )}

      <h3 className="h5 mt-4">
        QR Codes{rows !== null && ` (${count})`}
        <HelpTip id="help-tag-list" title="QR Codes">
          Tous les QR Codes générés, l'objet qui les porte et leur état. Un QR Code révoqué ne peut plus être
          scanné. Cochez des QR Codes pour les réimprimer : ceux qui sont associés portent le numéro
          de leur objet sous le code.
        </HelpTip>
      </h3>
      <Row className="g-2 mb-3">
        <Col xs={12} md={5}>
          <Form.Control
            type="search"
            placeholder="Code ou n° de l'objet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Col>
        <Col xs={6} md={4}>
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value as TagStatus | '')} aria-label="Statut">
            <option value="">Statuts</option>
            <option value="free">Libres</option>
            <option value="associated">Associés</option>
            <option value="revoked">Révoqués</option>
          </Form.Select>
        </Col>
        <Col xs={6} md={3}>
          <Form.Select
            aria-label="Clef de signature"
            value={keyIndex}
            onChange={(e) => setKeyIndex(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Clefs</option>
            {(keys ?? []).map((key) => <option key={key.index} value={key.index}>Clef {key.index}</option>)}
          </Form.Select>
        </Col>
      </Row>

      {selected.size > 0 && (
        <Alert variant="light" className="d-flex flex-wrap gap-2 justify-content-between align-items-center py-2">
          <span>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <span className="d-flex flex-wrap gap-2">
            {selected.size > MAX_SHEET ? (
              <span className="small text-danger">Au plus {MAX_SHEET} QR Codes par PDF.</span>
            ) : (
              <SheetPdfButton
                variant="primary"
                request={() => fetchAdminTagSheetLink(selectedIds)}
                requestKey={selectedIds.join()}
                onError={setError}
              >
                Réimprimer (PDF)
              </SheetPdfButton>
            )}
            <Button variant="outline-secondary" size="sm" onClick={() => setSelected(new Set())}>
              <i className="bi bi-x-lg me-1" aria-hidden="true" />Désélectionner
            </Button>
          </span>
        </Alert>
      )}

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

      <AppModal
        show={qr !== null}
        onHide={() => setQr(null)}
        size="sm"
        title={<>QR Code <code>{qr?.short}</code></>}
        footer={qr && (
          <SheetPdfButton request={() => fetchTagSheetLink([qr.value])} requestKey={qr.value} onError={setError}>
            Imprimer (PDF)
          </SheetPdfButton>
        )}
      >
        {qr && (
          <div className="text-center">
            <img src={qr.qr_svg} alt={`QR Code ${qr.short}`} className="w-100" style={{ maxWidth: 320 }} />
            {qr.caption && <div className="small mt-1">{qr.caption}</div>}
            <div className="small text-muted text-break mt-2">{qr.url}</div>
          </div>
        )}
      </AppModal>

      <ConfirmDialog
        show={toRevoke !== null}
        onHide={() => setToRevoke(null)}
        onConfirm={() => void handleRevoke()}
        title={`Révoquer le QR Code ${toRevoke?.short ?? ''} ?`}
        message={toRevoke?.trap
          ? `Associé à : ${taggedObject(toRevoke)?.label} ; le scanner ne l'ouvrira plus. Action définitive.`
          : 'Il ne pourra plus être associé. Action définitive.'}
        confirmLabel="Révoquer"
        confirmIcon="x-octagon"
        busy={revoking}
      />
    </>
  );
}
