import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal, Switch } from '../ui';
import { useAppDispatch } from '../../store/hooks';
import { createTrapType, updateTrapType, type TrapType } from '../../store/store';
import { PhotoInput } from '../traps';

/** Reminder delays offered, in days: a native picker (the wheel on iOS) rather than a free number */
const DAY_CHOICES = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 28, 30, 45, 60, 90];

const daysLabel = (days: number) => (days === 1 ? 'Tous les jours' : `Tous les ${days} jours`);

/** The choices, plus the stored value when it is not one of them, so editing never changes it */
const dayChoices = (current: string) => {
  const value = Number(current);
  return current !== '' && !DAY_CHOICES.includes(value)
    ? [...DAY_CHOICES, value].sort((a, b) => a - b)
    : DAY_CHOICES;
};

interface TrapTypeFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** Existing entry to edit; a new one is created when absent */
  trapType?: TrapType | null;
}

export default function TrapTypeFormModal({ onHide, trapType = null }: TrapTypeFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(trapType);

  const [name, setName] = useState(trapType?.name ?? '');
  const [description, setDescription] = useState(trapType?.description ?? '');
  const [sortOrder, setSortOrder] = useState(trapType?.sort_order ?? 0);
  const [apiaryBound, setApiaryBound] = useState(trapType?.apiary_bound ?? false);
  const [accumulates, setAccumulates] = useState(trapType?.accumulates ?? false);
  const [readingDays, setReadingDays] = useState(trapType?.reading_interval_days?.toString() ?? '');
  const [refillDays, setRefillDays] = useState(trapType?.refill_interval_days?.toString() ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const days = (text: string) => (text.trim() === '' ? null : Number(text));
      const values = {
        name, description, sort_order: sortOrder, apiary_bound: apiaryBound, accumulates,
        reading_interval_days: days(readingDays), refill_interval_days: days(refillDays), photo,
      };
      if (trapType) {
        await dispatch(updateTrapType({ id: trapType.id, values })).unwrap();
      } else {
        // The backend derives the technical identifier from the name
        await dispatch(createTrapType(values)).unwrap();
      }
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon="🪤"
      title={isEdit ? 'Modifier le type de piège' : 'Ajouter un type de piège'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving || !name}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Enregistrer
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Nom</Form.Label>
        <Form.Control
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          Ordre d'affichage
          <HelpTip id="sort-order-help" title="Ordre d'affichage">Les valeurs les plus basses apparaissent en premier.</HelpTip>
        </Form.Label>
        <Form.Control
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(Number(event.target.value))}
        />
      </Form.Group>

      <div className="mb-3">
        <Switch
          id="trap-type-apiary-bound"
          label="Lié à un rucher"
          checked={apiaryBound}
          onChange={setApiaryBound}
          help={(
            <HelpTip id="apiary-bound-help" title="Lié à un rucher">
              Ces pièges ne s'installent que devant des ruches : ceux d'un apiculteur sont toujours privés, les
              montrer révélerait un rucher (propriétaire, groupe délégué et admins seulement). Ceux d'une
              personne qui n'a pas de ruches peuvent être publics. Cocher cette case rend privés les pièges déjà
              créés de ce type par des apiculteurs ; la décocher ne les rouvre pas.
            </HelpTip>
          )}
        />
        <Switch
          id="trap-type-accumulates"
          label="Accumule les captures"
          checked={accumulates}
          onChange={setAccumulates}
          help={(
            <HelpTip id="accumulates-help" doc="traps#journal" title="Accumule les captures">
              Les prises restent dans le piège d'un relevé à l'autre (harpe, nasse, piège létal...) :
              on compte ce qu'il contient et l'on indique s'il a été vidé, l'application en déduit les
              nouvelles prises. Sinon (filet...), chaque relevé retire tout ce qui a été pris.
            </HelpTip>
          )}
        />
      </div>

      <h3 className="h6 text-uppercase text-muted mt-4 mb-2">Rappels aux propriétaires</h3>
      {([
        ['reading', 'Relevé', readingDays, setReadingDays,
          "Le propriétaire d'un piège de ce type reçoit un rappel quand son dernier relevé (ou, à défaut, "
          + "l'installation) date de ce nombre de jours. Aucun rappel : pour les pièges qu'on ne relève pas à date fixe."],
        ['refill', "Recharge de l'attractif", refillDays, setRefillDays,
          "Rappel quand la dernière recharge (ou l'installation) date de ce nombre de jours. Aucun rappel : "
          + "pour les pièges sans attractif."],
      ] as const).map(([key, label, value, setValue, help]) => (
        <Form.Group className="mb-3" controlId={`trap-type-${key}-days`} key={key}>
          <Form.Label className="d-flex align-items-center">
            {label}
            <HelpTip id={`${key}-days-help`} doc="traps#reminders" title={label}>{help}</HelpTip>
          </Form.Label>
          <Form.Select value={value} onChange={(event) => setValue(event.target.value)}>
            <option value="">Aucun rappel</option>
            {dayChoices(value).map((days) => (
              <option key={days} value={String(days)}>{daysLabel(days)}</option>
            ))}
          </Form.Select>
        </Form.Group>
      ))}

      <PhotoInput
        label={trapType?.photo_url ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
      />
    </AppModal>
  );
}
