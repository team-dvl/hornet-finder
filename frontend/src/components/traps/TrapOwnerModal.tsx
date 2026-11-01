import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  fetchTrapOwnerChoices, transferTrap,
  type Trap, type TrapOwnerChoices,
} from '../../store/store';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';

interface TrapOwnerModalProps {
  /** Mounted only while open, so every opening starts afresh */
  onHide: () => void;
  trap: Trap;
  /** Called once the trap has been handed over */
  onTransferred?: () => void;
}

/**
 * Hand a trap over to a member of one of the owner's groups (the trappers, an
 * association of beekeepers): a bequeathed trap, or one passed on by the
 * administrator of the group. Its delegation is cleared, the new owner
 * delegates again. People are named by first and last name, never by email.
 */
export default function TrapOwnerModal({ onHide, trap, onTransferred }: TrapOwnerModalProps) {
  const dispatch = useAppDispatch();
  const [choices, setChoices] = useState<TrapOwnerChoices | null>(null);
  const [groupPath, setGroupPath] = useState('');
  // Answers and pick are tied to their group, so changing group needs no reset
  const [loaded, setLoaded] = useState<{ group: string; list: NonNullable<TrapOwnerChoices['members']> } | null>(null);
  const [picked, setPicked] = useState<{ group: string; guid: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch(fetchTrapOwnerChoices({ trapId: trap.id })).unwrap()
      .then((found) => {
        if (cancelled) return;
        setChoices(found);
        setGroupPath(found.groups[0]?.path ?? '');
      })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, trap.id]);

  useEffect(() => {
    if (!groupPath) return;
    let cancelled = false;
    dispatch(fetchTrapOwnerChoices({ trapId: trap.id, groupPath })).unwrap()
      .then((found) => { if (!cancelled) setLoaded({ group: groupPath, list: found.members ?? [] }); })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, trap.id, groupPath]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await dispatch(transferTrap({ trapId: trap.id, ownerGuid: selected, groupPath })).unwrap();
      onTransferred?.();
      onHide();
    } catch (transferError) {
      setError(transferError as string);
      setSaving(false);
    }
  };

  const members = loaded?.group === groupPath ? loaded.list : undefined;
  const selected = picked?.group === groupPath ? picked.guid : '';
  const currentOwner = choices?.owner_guid ?? null;
  const loading = !choices && !error;

  return (
    <AppModal
      show
      onHide={onHide}
      icon={OBJECT_ICONS.trap}
      title="Changer de propriétaire"
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving || !selected}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Transférer
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {loading && <Spinner animation="border" size="sm" />}

      {choices && choices.groups.length > 1 && (
        <Form.Group className="mb-3" controlId={`trap-${trap.id}-owner-group`}>
          <Form.Label className="small mb-1">Groupe</Form.Label>
          <Form.Select value={groupPath} onChange={(event) => setGroupPath(event.target.value)}>
            {choices.groups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      {choices && choices.groups.length === 0 && <p className="text-muted mb-0">Aucun groupe.</p>}

      {groupPath && (
        <>
          <div className="small mb-1 d-flex align-items-center">
            Nouveau propriétaire
            <HelpTip id="trap-owner-help" doc="traps#permissions" title="Changer de propriétaire">
              Le piège passe à la personne choisie, qui peut alors le modifier, le déplacer et
              le supprimer, et en reçoit les rappels. Sa délégation est retirée : la nouvelle
              personne le délègue de nouveau si besoin.
            </HelpTip>
          </div>
          {!members && !error && <Spinner animation="border" size="sm" />}
          {members?.length === 0 && <p className="text-muted mb-0">Aucun membre.</p>}
          {members?.map((member) => {
            const isCurrent = member.guid === currentOwner;
            return (
              <Form.Check
                key={member.guid}
                type="radio"
                name="trap-new-owner"
                id={`trap-${trap.id}-owner-${member.guid}`}
                className="py-2 border-bottom"
                label={`${member.name ?? 'Sans nom'}${isCurrent ? ' (propriétaire actuel)' : ''}`}
                checked={selected === member.guid}
                disabled={isCurrent || saving}
                onChange={() => setPicked({ group: groupPath, guid: member.guid })}
              />
            );
          })}
        </>
      )}
    </AppModal>
  );
}
