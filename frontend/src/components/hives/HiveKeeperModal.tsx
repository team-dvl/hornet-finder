import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import {
  fetchKeeperChoices, hiveErrorOf, hiveLabel, setKeeper, today, type Hive, type KeeperChoices,
} from '../../utils/hivesApi';

interface HiveKeeperModalProps {
  hive: Hive;
  onHide: () => void;
  onDone: (hive: Hive) => void;
}

type Members = NonNullable<KeeperChoices['members']>;

/**
 * Entrust a hive to a beekeeper: the user, or a member of the owning
 * association (of one of the user's for a hive of their own). People are
 * named by first and last name, never by email.
 */
export default function HiveKeeperModal({ hive, onHide, onDone }: HiveKeeperModalProps) {
  const { userGuid } = useUserPermissions();
  const [choices, setChoices] = useState<KeeperChoices | null>(null);
  const [groupPath, setGroupPath] = useState('');
  // Answers and pick are tied to their group, so changing group needs no reset
  const [loaded, setLoaded] = useState<{ group: string; list: Members } | null>(null);
  const [picked, setPicked] = useState<{ group: string; guid: string } | null>(null);
  const [on, setOn] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchKeeperChoices(hive.id)
      .then((found) => {
        if (cancelled) return;
        setChoices(found);
        setGroupPath(found.groups[0]?.path ?? '');
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [hive.id]);

  useEffect(() => {
    if (!groupPath) return;
    let cancelled = false;
    fetchKeeperChoices(hive.id, groupPath)
      .then((found) => { if (!cancelled) setLoaded({ group: groupPath, list: found.members ?? [] }); })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [hive.id, groupPath]);

  const members = loaded?.group === groupPath ? loaded.list : undefined;
  const selected = picked?.group === groupPath ? picked.guid : '';
  const currentKeeper = choices?.keeper_guid ?? hive.keeper?.guid ?? null;
  // A hive of one's own may come back to oneself without picking an association
  const selfOffered = hive.owner?.kind === 'user' && userGuid && userGuid !== currentKeeper
    && !members?.some((member) => member.guid === userGuid);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const self = selected === userGuid && !members?.some((member) => member.guid === userGuid);
      onDone(await setKeeper(hive.id, selected, self ? null : groupPath, on));
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  const radio = (guid: string, label: string) => {
    const isCurrent = guid === currentKeeper;
    return (
      <Form.Check
        key={guid}
        type="radio"
        name="hive-new-keeper"
        id={`hive-keeper-${guid}`}
        className="py-2 border-bottom"
        label={`${label}${isCurrent ? ' (actuellement)' : ''}`}
        checked={selected === guid}
        disabled={isCurrent || saving}
        onChange={() => setPicked({ group: groupPath, guid })}
      />
    );
  };

  return (
    <AppModal
      show
      onHide={onHide}
      icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
      title="Confier la ruche"
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving || !selected}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Confier
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <p className="fw-semibold mb-3">{hiveLabel(hive)}</p>
      {!choices && !error && <Spinner animation="border" size="sm" />}

      {choices && choices.groups.length > 1 && (
        <Form.Group className="mb-3" controlId="hive-keeper-group">
          <Form.Label className="small mb-1">Association</Form.Label>
          <Form.Select value={groupPath} onChange={(event) => setGroupPath(event.target.value)} disabled={saving}>
            {choices.groups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      {choices && (
        <>
          <div className="small mb-1 d-flex align-items-center">
            Apiculteur
            <HelpTip id="hive-keeper-help" doc="apiaries#hives" title="Confier une ruche">
              La personne à qui la ruche est confiée la modifie, la déplace et la remise. Le
              propriétaire reste le même ; la période précédente est gardée dans l'historique.
            </HelpTip>
          </div>
          {selfOffered && userGuid && radio(userGuid, 'Moi')}
          {groupPath && !members && !error && <Spinner animation="border" size="sm" />}
          {members?.length === 0 && <p className="text-muted mb-0">Aucun membre.</p>}
          {members?.map((member) => radio(member.guid, member.guid === userGuid ? 'Moi' : (member.name ?? 'Sans nom')))}
        </>
      )}

      <Form.Group className="mt-3 mb-0" controlId="hive-keeper-on">
        <Form.Label>À partir du</Form.Label>
        <Form.Control
          type="date"
          value={on}
          max={today()}
          onChange={(event) => setOn(event.target.value)}
          disabled={saving}
          required
        />
      </Form.Group>
    </AppModal>
  );
}
