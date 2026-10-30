import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import {
  createHive, fetchHiveTypes, fetchOwnerGroups, fetchPlaceableApiaries, hiveErrorOf, today, updateHive,
  type Hive, type HiveType, type PlaceableApiary,
} from '../../utils/hivesApi';

interface HiveFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** When set, the form edits this hive instead of creating one */
  hive?: Hive | null;
  /** New hive: the apiary it is added to */
  apiaryId?: number | null;
  onSaved: (hive: Hive) => void;
}

/**
 * Create or edit a hive. A new one stands in an apiary (in service) or
 * nowhere (stored); it belongs to the user or to one of their associations
 * and is kept by the user. Where it stands and who keeps it change later
 * through the actions of its sheet, which keep the history.
 */
export default function HiveFormModal({ onHide, hive = null, apiaryId = null, onSaved }: HiveFormModalProps) {
  const { isAdmin } = useUserPermissions();
  const isEdit = Boolean(hive);
  const [types, setTypes] = useState<HiveType[] | null>(null);
  const [apiaries, setApiaries] = useState<PlaceableApiary[] | null>(null);
  const [ownerGroups, setOwnerGroups] = useState<{ path: string; name: string }[]>([]);

  const [hiveType, setHiveType] = useState(hive?.hive_type ?? 0);
  const [name, setName] = useState(hive?.name ?? '');
  const [number, setNumber] = useState(hive?.number ?? '');
  const [commissionedOn, setCommissionedOn] = useState(hive?.commissioned_on ?? '');
  const [comments, setComments] = useState(hive?.comments ?? '');
  const [apiary, setApiary] = useState<number | null>(apiaryId);
  const [placedOn, setPlacedOn] = useState(today());
  const [ownerGroup, setOwnerGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHiveTypes()
      .then((found) => {
        if (cancelled) return;
        setTypes(found);
        setHiveType((current) => current || found[0]?.id || 0);
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    if (!isEdit) {
      fetchPlaceableApiaries(isAdmin)
        .then((found) => { if (!cancelled) setApiaries(found); })
        .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
      fetchOwnerGroups()
        .then((found) => { if (!cancelled) setOwnerGroups(found); })
        .catch(() => { /* the user alone remains offered */ });
    }
    return () => { cancelled = true; };
  }, [isEdit, isAdmin]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !hiveType) return;
    setSaving(true);
    setError(null);
    const values = {
      hive_type: hiveType,
      name: name.trim(),
      number: number.trim(),
      commissioned_on: commissionedOn || null,
      comments: comments.trim(),
    };
    try {
      const saved = hive
        ? await updateHive(hive.id, values)
        : await createHive({
          ...values,
          apiary,
          ...(apiary ? { placed_on: placedOn } : {}),
          ...(ownerGroup ? { owner_group: ownerGroup } : {}),
        });
      onSaved(saved);
      onHide();
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  // The apiary it was opened from stays offered even before the list arrives
  const apiaryOptions = apiaries ?? [];

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
      title={isEdit ? 'Modifier la ruche' : 'Nouvelle ruche'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || !types || !name.trim()}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          {isEdit ? 'Enregistrer' : 'Ajouter'}
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3" controlId="hive-type">
        <Form.Label className="d-flex align-items-center">
          Type
          {isEdit && (
            <HelpTip id="hive-type-help" doc="apiaries#hives" title="Type de ruche">
              Le type d'une ruche ne change pas : les barrettes et les colonies en dépendent.
            </HelpTip>
          )}
        </Form.Label>
        <Form.Select
          value={hiveType || ''}
          onChange={(event) => setHiveType(Number(event.target.value))}
          disabled={isEdit || saving || !types}
          required
        >
          {!types && <option value="">Chargement…</option>}
          {types?.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </Form.Select>
      </Form.Group>

      <div className="d-flex gap-2">
        <Form.Group className="mb-3 flex-grow-1" controlId="hive-name">
          <Form.Label>Nom</Form.Label>
          <Form.Control
            type="text"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3 hive-number-field flex-shrink-0" controlId="hive-number">
          <Form.Label>N°</Form.Label>
          <Form.Control
            type="text"
            value={number}
            maxLength={16}
            onChange={(event) => setNumber(event.target.value)}
            disabled={saving}
          />
        </Form.Group>
      </div>

      {!isEdit && (
        <>
          <Form.Group className="mb-3" controlId="hive-apiary">
            <Form.Label className="d-flex align-items-center">
              Rucher
              <HelpTip id="hive-apiary-help" doc="apiaries#hives" title="Où se trouve la ruche">
                Une ruche dans un rucher est en service. Sans rucher, elle est remisée : vide, ou en
                attente d'une colonie. Seuls les ruchers que vous pouvez modifier sont proposés.
              </HelpTip>
            </Form.Label>
            <Form.Select
              value={apiary ?? ''}
              onChange={(event) => setApiary(event.target.value ? Number(event.target.value) : null)}
              disabled={saving || apiaries === null}
            >
              <option value="">Aucun : remisée</option>
              {apiaryId && !apiaryOptions.some((option) => option.id === apiaryId) && (
                <option value={apiaryId}>Rucher #{apiaryId}</option>
              )}
              {apiaryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Form.Select>
          </Form.Group>

          {apiary && (
            <Form.Group className="mb-3" controlId="hive-placed-on">
              <Form.Label>Installée le</Form.Label>
              <Form.Control
                type="date"
                value={placedOn}
                max={today()}
                onChange={(event) => setPlacedOn(event.target.value)}
                disabled={saving}
                required
              />
            </Form.Group>
          )}

          {ownerGroups.length > 0 && (
            <Form.Group className="mb-3" controlId="hive-owner">
              <Form.Label className="d-flex align-items-center">
                Propriétaire
                <HelpTip id="hive-owner-help" doc="apiaries#hives" title="Propriétaire">
                  Vous, ou une de vos associations. Les administrateurs de l'association peuvent
                  alors la confier à un autre membre, la réformer ou la supprimer.
                </HelpTip>
              </Form.Label>
              <Form.Select value={ownerGroup} onChange={(event) => setOwnerGroup(event.target.value)} disabled={saving}>
                <option value="">Moi</option>
                {ownerGroups.map((group) => <option key={group.path} value={group.path}>{group.name}</option>)}
              </Form.Select>
            </Form.Group>
          )}
        </>
      )}

      <Form.Group className="mb-3" controlId="hive-commissioned">
        <Form.Label>Mise en service</Form.Label>
        <Form.Control
          type="date"
          value={commissionedOn}
          max={today()}
          onChange={(event) => setCommissionedOn(event.target.value)}
          disabled={saving}
        />
      </Form.Group>

      <Form.Group className="mb-0" controlId="hive-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          disabled={saving}
        />
      </Form.Group>
    </AppModal>
  );
}
