import { useEffect, useState } from 'react';
import { Accordion, Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  fetchApiarySharing, shareApiary, unshareApiary,
  type Apiary, type ApiarySharingInfo,
} from '../../store/store';
import { HelpTip } from '../common';
import { ACTION_ICONS } from '../../utils/icons';

interface ApiarySharingPanelProps {
  apiary: Apiary & { id: number };
}

/**
 * Groups an apiary is shared with: their members see it, and may modify it
 * when allowed to. Only the owner (or a platform admin) changes the sharing;
 * the groups on offer, the owner's associations, come from the backend.
 */
export default function ApiarySharingPanel({ apiary }: ApiarySharingPanelProps) {
  const dispatch = useAppDispatch();
  const grants = apiary.extended_permissions ?? [];
  const canShare = Boolean(apiary.permissions?.share);

  const [info, setInfo] = useState<ApiarySharingInfo | null>(null);
  const [groupPath, setGroupPath] = useState('');
  const [canUpdate, setCanUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canShare) return;
    let cancelled = false;
    dispatch(fetchApiarySharing(apiary.id))
      .unwrap()
      .then((sharing) => { if (!cancelled) setInfo(sharing); })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, apiary.id, canShare]);

  const shared = new Set(grants.map((grant) => grant.group));
  const available = info?.allowed_groups?.filter((group) => !shared.has(group.path)) ?? [];
  // The select shows the first available group until the user picks another
  const selectedPath = info?.allowed_groups === null
    ? groupPath
    : (available.some((group) => group.path === groupPath) ? groupPath : available[0]?.path ?? '');

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError as string);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => run(async () => {
    await dispatch(shareApiary({ id: apiary.id, groupPath: selectedPath.trim(), canUpdate })).unwrap();
    setGroupPath('');
    setCanUpdate(false);
  });

  // Collapsed by default; the header is there from the first render
  return (
    <Accordion className="mt-3">
      <Accordion.Item eventKey="sharing">
        <Accordion.Header>
          <span className="me-2" aria-hidden="true">🤝</span>
          <span className="me-2">Partage</span>
          <span className="d-flex flex-wrap gap-1 min-w-0">
            {grants.length === 0
              ? <span className="text-muted small">privé</span>
              : grants.map((grant) => (
                <Badge key={grant.group} bg="primary" className="text-truncate">{grant.group_name || grant.group}</Badge>
              ))}
          </span>
        </Accordion.Header>

        <Accordion.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          {grants.length === 0 && (
            <p className="small text-muted mb-2">Visible de son propriétaire seulement.</p>
          )}

          {grants.map((grant) => (
            <div key={grant.group} className="d-flex align-items-center gap-2 py-1 border-bottom">
              <span className="flex-grow-1 min-w-0 text-truncate">{grant.group_name || grant.group}</span>
              {canShare ? (
                <Form.Check
                  type="switch"
                  id={`apiary-${apiary.id}-${grant.group}-update`}
                  className="mb-0 flex-shrink-0 small"
                  label="Peut modifier"
                  checked={grant.can_update}
                  disabled={busy}
                  onChange={(event) => run(() => dispatch(shareApiary({
                    id: apiary.id, groupPath: grant.group, canUpdate: event.target.checked,
                  })).unwrap())}
                />
              ) : (
                <span className="small text-muted flex-shrink-0">
                  {grant.can_update ? 'consulte et modifie' : 'consulte'}
                </span>
              )}
              {canShare && (
                <Button
                  variant="link"
                  className="text-danger icon-button flex-shrink-0"
                  aria-label={`Ne plus partager avec ${grant.group_name || grant.group}`}
                  title="Ne plus partager"
                  disabled={busy}
                  onClick={() => run(() => dispatch(unshareApiary({ id: apiary.id, groupPath: grant.group })).unwrap())}
                >
                  <i className={`bi bi-${ACTION_ICONS.delete}`} aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}

          {canShare && !info && !error && <Spinner animation="border" size="sm" className="mt-2" />}

          {canShare && info && (
            <div className="mt-3">
              <Form.Label htmlFor={`apiary-${apiary.id}-share-group`} className="small mb-1 d-flex align-items-center">
                Partager avec
                <HelpTip id="apiary-share-help" title="Partage">
                  Les membres de l'association voient le rucher ; avec « Peut modifier », ils
                  peuvent aussi le mettre à jour. La suppression reste réservée au propriétaire.
                </HelpTip>
              </Form.Label>
              {info.allowed_groups === null ? (
                // Platform admin: any group path is accepted
                <Form.Control
                  id={`apiary-${apiary.id}-share-group`}
                  type="text"
                  value={groupPath}
                  placeholder="/beekeepers/mon-association"
                  onChange={(event) => setGroupPath(event.target.value)}
                />
              ) : (
                <Form.Select
                  id={`apiary-${apiary.id}-share-group`}
                  value={selectedPath}
                  onChange={(event) => setGroupPath(event.target.value)}
                  disabled={available.length === 0}
                >
                  {available.length === 0 && (
                    <option value="">
                      {info.allowed_groups.length === 0 ? 'Aucune association' : 'Déjà partagé avec toutes vos associations'}
                    </option>
                  )}
                  {available.map((group) => (
                    <option key={group.path} value={group.path}>{group.name}</option>
                  ))}
                </Form.Select>
              )}
              <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                <Form.Check
                  type="switch"
                  id={`apiary-${apiary.id}-share-update`}
                  className="mb-0 me-auto"
                  label="Peut modifier"
                  checked={canUpdate}
                  onChange={(event) => setCanUpdate(event.target.checked)}
                />
                <Button variant="primary" onClick={handleShare} disabled={busy || !selectedPath.trim()}>
                  {busy ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-share me-2" aria-hidden="true" />}
                  Partager
                </Button>
              </div>
            </div>
          )}
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}
