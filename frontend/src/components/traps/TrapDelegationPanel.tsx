import { useEffect, useState } from 'react';
import { Accordion, Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  clearTrapDelegation, fetchTrapDelegation, setTrapDelegation, updateTrap,
  type DelegationInfo, type Trap,
} from '../../store/store';
import { HelpTip } from '../common';

interface TrapDelegationPanelProps {
  trap: Trap;
}

/**
 * Visibility of a trap (public, or restricted to its owner, its delegated group
 * and the admins) and its delegation to a group: which association may maintain
 * it. The two are independent.
 *
 * The list of groups the current user may pick comes from the backend, which
 * is the only side that knows the *owner's* groups.
 */
export default function TrapDelegationPanel({ trap }: TrapDelegationPanelProps) {
  const dispatch = useAppDispatch();
  const [info, setInfo] = useState<DelegationInfo | null>(null);
  const [groupPath, setGroupPath] = useState('');
  const bound = Boolean(trap.trap_type.apiary_bound);
  const isPublic = trap.visibility === 'public';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch(fetchTrapDelegation(trap.id))
      .unwrap()
      .then((delegation) => {
        if (cancelled) return;
        setInfo(delegation);
        setGroupPath(delegation.group?.path ?? delegation.allowed_groups[0]?.path ?? '');
      })
      .catch(() => { /* the panel then only shows what the trap already carries */ });
    return () => { cancelled = true; };
  }, [dispatch, trap.id]);

  const handleSave = async () => {
    if (!groupPath) return;
    setBusy(true);
    setError(null);
    try {
      await dispatch(setTrapDelegation({ trapId: trap.id, groupPath })).unwrap();
    } catch (saveError) {
      setError(saveError as string);
    } finally {
      setBusy(false);
    }
  };

  const handleVisibility = async (makePublic: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(updateTrap({ trapId: trap.id, values: { visibility: makePublic ? 'public' : 'restricted' } })).unwrap();
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

  // Collapsed by default, and the header is there from the first render: the
  // groups the user may pick are only known after a round trip to the server,
  // and the panel used to appear under the journal once the answer came back.
  return (
    <Accordion className="mt-2">
      <Accordion.Item eventKey="delegation">
        <Accordion.Header>
          <span className="me-2">🤝</span>
          <span className="me-2">Délégation</span>
          {trap.group
            ? <Badge bg="primary">{trap.group.name}</Badge>
            : <span className="text-muted small">aucun groupe</span>}
        </Accordion.Header>

        <Accordion.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          {bound ? (
            <p className="mb-2 small">
              <i className="bi bi-lock-fill me-1" aria-hidden="true" />Privé
              <HelpTip id={`trap-${trap.id}-bound-help`} doc="traps#delegation" title="Privé">
                Ce type de piège ne s'installe que devant des ruches : le montrer révélerait un rucher.
                Il n'est visible que de son propriétaire, du groupe délégué et des admins.
              </HelpTip>
            </p>
          ) : (
            <div className="d-flex align-items-center mb-2">
              {trap.permissions?.update ? (
                <Form.Check
                  type="switch"
                  id={`trap-${trap.id}-public`}
                  className="small"
                  label="Piège public"
                  checked={isPublic}
                  disabled={busy}
                  onChange={(event) => void handleVisibility(event.target.checked)}
                />
              ) : (
                <span className="small">{isPublic ? 'Public' : 'Restreint'}</span>
              )}
              <HelpTip id={`trap-${trap.id}-visibility-help`} doc="traps#delegation" title="Visibilité">
                Public : position et captures visibles de tous, y compris sans compte. Restreint : visible de son
                propriétaire, du groupe délégué et des admins seulement.
              </HelpTip>
            </div>
          )}

          {trap.group ? (
            <p className="mb-2 small">
              Entretien délégué à <Badge bg="primary">{trap.group.name}</Badge>
            </p>
          ) : (
            <p className="mb-2 small text-muted">
              Aucun groupe désigné : seul le propriétaire entretient ce piège.
            </p>
          )}

          {!info && <Spinner animation="border" size="sm" />}

          {info?.can_set_delegation && (
            <>
              <Form.Group className="mb-2">
                <Form.Label className="small mb-1">Désigner un groupe</Form.Label>
                <Form.Select
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
              </Form.Group>

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
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}
