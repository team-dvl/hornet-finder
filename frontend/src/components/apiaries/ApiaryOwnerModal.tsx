import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  fetchApiaryOwnerChoices, transferApiary,
  type Apiary, type ApiaryOwnerChoices,
} from '../../store/store';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';

interface ApiaryOwnerModalProps {
  /** Mounted only while open, so every opening starts afresh */
  onHide: () => void;
  apiary: Apiary & { id: number };
  /** Called once the apiary has been handed over */
  onTransferred?: () => void;
}

/**
 * Hand an apiary over to a member of one of the owner's associations: an
 * administrator creates it for someone who is not at ease with the app, then
 * transfers it. People are named by first and last name, never by email.
 */
export default function ApiaryOwnerModal({ onHide, apiary, onTransferred }: ApiaryOwnerModalProps) {
  const dispatch = useAppDispatch();
  const [choices, setChoices] = useState<ApiaryOwnerChoices | null>(null);
  const [groupPath, setGroupPath] = useState('');
  // Answers and pick are tied to their group, so changing group needs no reset
  const [loaded, setLoaded] = useState<{ group: string; list: NonNullable<ApiaryOwnerChoices['members']> } | null>(null);
  const [picked, setPicked] = useState<{ group: string; guid: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch(fetchApiaryOwnerChoices({ id: apiary.id })).unwrap()
      .then((found) => {
        if (cancelled) return;
        setChoices(found);
        setGroupPath(found.groups[0]?.path ?? '');
      })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, apiary.id]);

  useEffect(() => {
    if (!groupPath) return;
    let cancelled = false;
    dispatch(fetchApiaryOwnerChoices({ id: apiary.id, groupPath })).unwrap()
      .then((found) => { if (!cancelled) setLoaded({ group: groupPath, list: found.members ?? [] }); })
      .catch((fetchError) => { if (!cancelled) setError(fetchError as string); });
    return () => { cancelled = true; };
  }, [dispatch, apiary.id, groupPath]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await dispatch(transferApiary({ id: apiary.id, ownerGuid: selected, groupPath })).unwrap();
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
      icon={OBJECT_ICONS.apiary}
      title={`Rucher #${apiary.id} : changer de propriétaire`}
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
        <Form.Group className="mb-3" controlId={`apiary-${apiary.id}-owner-group`}>
          <Form.Label className="small mb-1">Association</Form.Label>
          <Form.Select value={groupPath} onChange={(event) => setGroupPath(event.target.value)}>
            {choices.groups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      {choices && choices.groups.length === 0 && <p className="text-muted mb-0">Aucune association.</p>}

      {groupPath && (
        <>
          <div className="small mb-1 d-flex align-items-center">
            Nouveau propriétaire
            <HelpTip id="apiary-owner-help" title="Changer de propriétaire">
              Le rucher passe à la personne choisie, qui peut alors le modifier, le partager et
              le supprimer. Vous ne le voyez plus ensuite, sauf s'il est partagé avec votre
              association.
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
                name="apiary-new-owner"
                id={`apiary-${apiary.id}-owner-${member.guid}`}
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
