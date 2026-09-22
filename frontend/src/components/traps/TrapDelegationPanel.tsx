import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  clearTrapDelegation, fetchTrapDelegation, setTrapDelegation,
  type DelegationInfo, type Trap,
} from '../../store/store';

interface TrapDelegationPanelProps {
  trap: Trap;
}

/**
 * Delegation of a trap to a group: which association may maintain it, and
 * whether the trap is visible to that group only.
 *
 * The list of groups the current user may pick comes from the backend, which
 * is the only side that knows the *owner's* groups.
 */
export default function TrapDelegationPanel({ trap }: TrapDelegationPanelProps) {
  const dispatch = useAppDispatch();
  const [info, setInfo] = useState<DelegationInfo | null>(null);
  const [groupPath, setGroupPath] = useState('');
  // The switch follows the trap until the user overrides it
  const [groupOnlyOverride, setGroupOnlyOverride] = useState<boolean | null>(null);
  const groupOnly = groupOnlyOverride ?? trap.visibility === 'group';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch(fetchTrapDelegation(trap.id))
      .unwrap()
      .then((delegation) => {
        if (cancelled) return;
        setInfo(delegation);
        setGroupPath(delegation.group?.path ?? delegation.allowed_groups?.[0]?.path ?? '');
      })
      .catch(() => { /* a read-only viewer simply gets no panel */ });
    return () => { cancelled = true; };
  }, [dispatch, trap.id]);

  if (!info) return null;

  const handleSave = async () => {
    if (!groupPath) return;
    setBusy(true);
    setError(null);
    try {
      await dispatch(setTrapDelegation({
        trapId: trap.id,
        groupPath,
        visibility: groupOnly ? 'group' : 'public',
      })).unwrap();
    } catch (saveError) {
      setError(saveError as string);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(clearTrapDelegation(trap.id)).unwrap();
    } catch (clearError) {
      setError(clearError as string);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-light rounded">
      <h6 className="mb-2">
        <span className="me-2">🤝</span>
        Délégation
      </h6>

      {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

      {trap.group ? (
        <p className="mb-2 small">
          Entretien délégué à <Badge bg="primary">{trap.group.name}</Badge>
          {trap.visibility === 'group' && (
            <Badge bg="secondary" className="ms-2">visible par ce groupe seulement</Badge>
          )}
        </p>
      ) : (
        <p className="mb-2 small text-muted">Aucun groupe désigné : vous seul entretenez ce piège.</p>
      )}

      {info.can_set_delegation && (
        <>
          <Form.Group className="mb-2">
            <Form.Label className="small mb-1">Désigner un groupe</Form.Label>
            {info.allowed_groups === null ? (
              // Platform admin: any group path is accepted
              <Form.Control
                type="text"
                size="sm"
                value={groupPath}
                placeholder="/beekeepers/mon-association"
                onChange={(event) => setGroupPath(event.target.value)}
              />
            ) : (
              <Form.Select
                size="sm"
                value={groupPath}
                onChange={(event) => setGroupPath(event.target.value)}
                disabled={info.allowed_groups.length === 0}
              >
                {info.allowed_groups.length === 0 && (
                  <option value="">Aucun groupe disponible</option>
                )}
                {info.allowed_groups.map((group) => (
                  <option key={group.path} value={group.path}>{group.name}</option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Check
            type="switch"
            id={`trap-${trap.id}-group-only`}
            className="small mb-2"
            label="Réserver la visibilité à ce groupe"
            checked={groupOnly}
            onChange={(event) => setGroupOnlyOverride(event.target.checked)}
          />

          <div className="d-flex gap-2">
            <Button size="sm" variant="primary" onClick={handleSave} disabled={busy || !groupPath}>
              {busy && <Spinner animation="border" size="sm" className="me-1" />}
              Enregistrer
            </Button>
            {trap.group && (
              <Button size="sm" variant="outline-danger" onClick={handleClear} disabled={busy}>
                Retirer la délégation
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
