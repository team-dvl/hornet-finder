import { useEffect, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { hiveErrorOf, type PersonSummary } from '../../utils/hivesApi';
import { fetchParticipantChoices, type ParticipantChoices } from '../../utils/visitsApi';

interface ParticipantsPickerProps {
  value: PersonSummary[];
  onChange: (people: PersonSummary[]) => void;
  disabled?: boolean;
}

type Members = NonNullable<ParticipantChoices['members']>;

/**
 * Who took part, among the members of one's associations (names only, never
 * an email). Rendered inline: a list of chips, and a list to pick from.
 */
export default function ParticipantsPicker({ value, onChange, disabled }: ParticipantsPickerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ParticipantChoices['groups'] | null>(null);
  const [groupPath, setGroupPath] = useState('');
  const [loaded, setLoaded] = useState<{ group: string; list: Members } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || groups) return;
    let cancelled = false;
    fetchParticipantChoices()
      .then((found) => {
        if (cancelled) return;
        setGroups(found.groups);
        setGroupPath(found.groups[0]?.path ?? '');
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [open, groups]);

  useEffect(() => {
    if (!open || !groupPath) return;
    let cancelled = false;
    fetchParticipantChoices(groupPath)
      .then((found) => { if (!cancelled) setLoaded({ group: groupPath, list: found.members ?? [] }); })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [open, groupPath]);

  const members = loaded?.group === groupPath ? loaded.list : undefined;
  const chosen = new Set(value.map((person) => person.guid));
  const toggle = (guid: string, name: string | null) => onChange(chosen.has(guid)
    ? value.filter((person) => person.guid !== guid)
    : [...value, { guid, display_name: name ?? 'Sans nom' }]);

  return (
    <div className="mb-3">
      <div className="visit-chips mb-1">
        {value.map((person) => (
          <Button key={person.guid} variant="outline-secondary" disabled={disabled}
            aria-label={`Retirer ${person.display_name}`} onClick={() => toggle(person.guid, person.display_name)}>
            {person.display_name}<i className="bi bi-x ms-1" aria-hidden="true" />
          </Button>
        ))}
        <Button variant={open ? 'secondary' : 'outline-primary'} disabled={disabled} onClick={() => setOpen((shown) => !shown)}
          aria-expanded={open}>
          <i className="bi bi-person-plus me-1" aria-hidden="true" />Ajouter
        </Button>
      </div>
      {open && (
        <div className="border rounded p-2">
          {error && <div className="text-danger small">{error}</div>}
          {!groups && !error && <Spinner animation="border" size="sm" />}
          {groups && groups.length > 1 && (
            <Form.Select className="mb-2" aria-label="Association" value={groupPath} disabled={disabled}
              onChange={(event) => setGroupPath(event.target.value)}>
              {groups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
            </Form.Select>
          )}
          {groups?.length === 0 && <div className="text-muted small">Aucune association.</div>}
          {groupPath && !members && !error && <Spinner animation="border" size="sm" />}
          {members?.map((member) => (
            <Form.Check
              key={member.guid}
              type="checkbox"
              id={`participant-${member.guid}`}
              className="py-2"
              label={member.name ?? 'Sans nom'}
              checked={chosen.has(member.guid)}
              disabled={disabled}
              onChange={() => toggle(member.guid, member.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
