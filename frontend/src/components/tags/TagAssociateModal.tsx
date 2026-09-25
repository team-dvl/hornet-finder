import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, ListGroup, Spinner } from 'react-bootstrap';
import { AppModal } from '../ui';
import type { Trap } from '../../store/slices/trapsSlice';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import {
  associateTag, fetchTagCandidates, TagError, type TagCandidate,
} from '../../utils/tagsApi';

interface TagAssociateModalProps {
  /** The scanned, still free tag */
  value: string;
  short: string;
  onHide: () => void;
  /** The tag is now attached to this trap */
  onAssociated: (trap: Trap) => void;
}

/**
 * Attach a freshly scanned tag to a trap: one of the user's own, or any trap
 * for an admin. A trap that already has a tag can be re-tagged after a
 * confirmation; its old tag is then revoked by the server.
 */
export default function TagAssociateModal({ value, short, onHide, onAssociated }: TagAssociateModalProps) {
  const { isAdmin } = useUserPermissions();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<TagCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Trap waiting for the "replace its tag" confirmation */
  const [toReplace, setToReplace] = useState<{ trap: TagCandidate; existingShort?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Debounced, so an admin typing an address does not fire one call per key
    const timer = window.setTimeout(() => {
      fetchTagCandidates(value, query)
        .then((list) => { if (!cancelled) setCandidates(list); })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof TagError ? e.message : String(e)); });
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, query]);

  const associate = async (trap: TagCandidate, replace: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const result = await associateTag(value, trap.id, replace);
      if (result.status === 'associated') onAssociated(result.trap);
    } catch (e) {
      if (e instanceof TagError && e.code === 'trap_has_tag') {
        // Someone tagged the trap in the meantime: ask before replacing
        setToReplace({ trap, existingShort: e.existingShort });
      } else {
        setError(e instanceof TagError ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const choose = (trap: TagCandidate) => {
    if (trap.has_tag) {
      setToReplace({ trap });
    } else {
      void associate(trap, false);
    }
  };

  const trapLabel = (trap: TagCandidate) => trap.address || `Piège n° ${trap.id}`;

  return (
    <AppModal show onHide={onHide} icon="🏷️" title={<>Nouveau QR Code <code className="fs-6">{short}</code></>}>
        {error && <Alert variant="danger">{error}</Alert>}

        {toReplace ? (
          <Alert variant="warning" className="mb-0">
            <p>
              <strong>{trapLabel(toReplace.trap)}</strong> a déjà un QR Code
              {toReplace.existingShort && <> (<code>{toReplace.existingShort}</code>)</>}.
              L'ancien QR Code sera <strong>détruit</strong> et ne pourra plus être scanné.
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <Button variant="outline-secondary" onClick={() => setToReplace(null)} disabled={saving}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => void associate(toReplace.trap, true)} disabled={saving}>
                {saving ? 'Remplacement…' : 'Remplacer'}
              </Button>
            </div>
          </Alert>
        ) : (
          <>
            <p className="text-muted small">Sur quel piège est-il posé ?</p>
            {isAdmin && (
              <Form.Control
                type="search"
                placeholder="Rechercher par adresse ou numéro"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-2"
              />
            )}
            {candidates === null ? (
              <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
            ) : candidates.length === 0 ? (
              <Alert variant="info" className="mb-0">
                {query ? 'Aucun piège ne correspond.' : "Vous n'avez aucun piège. Placez d'abord votre piège sur la carte."}
              </Alert>
            ) : (
              <ListGroup>
                {candidates.map((trap) => (
                  <ListGroup.Item
                    key={trap.id}
                    action
                    disabled={saving}
                    onClick={() => choose(trap)}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <span>
                      🪤 {trapLabel(trap)}
                      <span className="text-muted small d-block">
                        {trap.trap_type ?? '—'}{!trap.active && ' · retiré'}
                      </span>
                    </span>
                    {trap.has_tag && <Badge bg="secondary">QR Code existant</Badge>}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </>
        )}
    </AppModal>
  );
}
