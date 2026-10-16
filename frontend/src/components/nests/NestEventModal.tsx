import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import {
  recordNestEvent, type Nest, type NestActor, type NestBasis, type NestMeans, type NestOutcome, type NestType,
} from '../../store/store';
import { HelpTip } from '../common';
import { PhotoInput } from '../traps';
import { AppModal } from '../ui';
import { dateInputToIso, toDateInputValue } from '../../utils/format';
import {
  ACTORS, BASES, HEIGHT_CLASSES, MEANS, NEST_TYPES, SIZE_CLASSES, VISIT_OUTCOMES, suggestedNestType,
} from '../../utils/nestStatus';
import ChipChoice from './ChipChoice';

interface NestEventModalProps {
  /** Mounted only while open, so every opening starts afresh */
  onHide: () => void;
  nest: Nest & { id: number };
  kind: 'visit' | 'destruction';
  /** Whoever reported the nest declares its destruction in a short form */
  asReporter?: boolean;
  onSaved?: (nest: Nest) => void;
}

/**
 * A visit (coordinators: active, empty, another species, not found, and what
 * the nest looks like) or the neutralisation (destruction) of a nest (when, by whom, how).
 */
export default function NestEventModal({ onHide, nest, kind, asReporter = false, onSaved }: NestEventModalProps) {
  const dispatch = useAppDispatch();
  const isVisit = kind === 'visit';

  // Visit
  const [outcome, setOutcome] = useState<NestOutcome>('');
  const [basis, setBasis] = useState<NestBasis[]>([]);
  const [nestType, setNestType] = useState<NestType>(nest.nest_type || suggestedNestType(nest.created_at));
  const [height, setHeight] = useState(nest.height_class ?? '');
  const [size, setSize] = useState(nest.size_class ?? '');
  // Destruction
  const [day, setDay] = useState(toDateInputValue());
  const [actor, setActor] = useState<NestActor | ''>('');
  const [reference, setReference] = useState('');
  const [means, setMeans] = useState<NestMeans[]>([]);
  // Both
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isVisit && !outcome) {
      setError('Choisissez le résultat de la vérification.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await dispatch(recordNestEvent({
        id: nest.id,
        photos,
        values: isVisit
          ? {
            kind, outcome, basis, comments: comments.trim(),
            ...(outcome === 'active' ? { nest_type: nestType, height_class: height, size_class: size } : {}),
          }
          : {
            kind, performed_at: dateInputToIso(day), actor: actor || 'unknown', comments: comments.trim(),
            fixmystreet_ref: actor === 'fixmystreet' ? reference.trim() : undefined, means,
          },
      })).unwrap();
      onSaved?.(saved);
      onHide();
    } catch (saveError) {
      setError(saveError as string);
    } finally {
      setSaving(false);
    }
  };

  const title = isVisit ? `Vérification du nid #${nest.id}` : asReporter
    ? `Signaler le nid #${nest.id} neutralisé` : `Neutralisation du nid #${nest.id}`;

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={isVisit ? '🔍' : '✅'}
      title={title}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          {asReporter ? 'Signaler' : 'Enregistrer'}
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {isVisit ? (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Résultat</Form.Label>
            <ChipChoice name="visit-outcome" label="Résultat" options={VISIT_OUTCOMES} value={outcome}
              onChange={(value) => setOutcome(value as NestOutcome)} disabled={saving} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="d-flex align-items-center">
              Sur base de <span className="text-muted fw-normal ms-1">facultatif</span>
              <HelpTip id="verification-basis-help" doc="nests#status" title="Sur base de">
                Ce qui fonde la décision : les photos du signalement, un échange (par téléphone) avec la personne qui
                a signalé le nid, ou un passage sur place. Plusieurs à la fois.
              </HelpTip>
            </Form.Label>
            <ChipChoice name="verification-basis" label="Sur base de" options={BASES} value={basis} multiple
              onChange={(value) => setBasis(value as NestBasis[])} disabled={saving} />
          </Form.Group>
          {outcome === 'active' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center">
                  Type de nid <span className="text-muted fw-normal ms-1">facultatif</span>
                  <HelpTip id="visit-type-help" doc="nests#status" title="Primaire ou secondaire">
                    Pré-choisi d&apos;après la date du signalement : un nid de février à mai est en général primaire
                    (bâti par la reine fondatrice, petit, souvent bas et abrité) ; à partir de juillet, secondaire
                    (plus grand, souvent haut). À corriger si ce n&apos;est pas le cas ; un second appui sur le choix
                    l&apos;efface, comme pour la hauteur et la taille.
                  </HelpTip>
                </Form.Label>
                <ChipChoice name="visit-type" label="Type de nid" options={NEST_TYPES} value={nestType}
                  onChange={(value) => setNestType(value as NestType)} clearable disabled={saving} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Hauteur estimée <span className="text-muted fw-normal">facultatif</span></Form.Label>
                <ChipChoice name="visit-height" label="Hauteur estimée" options={HEIGHT_CLASSES} value={height}
                  onChange={(value) => setHeight(value as string)} clearable disabled={saving} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Taille estimée <span className="text-muted fw-normal">facultatif</span></Form.Label>
                <ChipChoice name="visit-size" label="Taille estimée" options={SIZE_CLASSES} value={size}
                  onChange={(value) => setSize(value as string)} clearable disabled={saving} />
              </Form.Group>
            </>
          )}
        </>
      ) : (
        <>
          <Form.Group className="mb-3" controlId="destruction-day">
            <Form.Label>{asReporter ? 'Quand' : 'Date'}</Form.Label>
            <Form.Control type="date" value={day} max={toDateInputValue()} required
              onChange={(event) => setDay(event.target.value)} disabled={saving} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="d-flex align-items-center">
              Par
              <HelpTip id="destruction-actor-help" doc="nests#destruction" title="Qui a neutralisé le nid">
                FixMyStreet : les destructeurs formés que la Région wallonne subventionne et attribue par zone, à qui
                l&apos;on s&apos;adresse par sa plateforme. Le numéro de la demande relie le nid au dossier.
              </HelpTip>
            </Form.Label>
            <ChipChoice name="destruction-actor" label="Par" value={actor}
              options={asReporter ? ACTORS : ACTORS.filter((entry) => entry.value !== 'unknown')}
              onChange={(value) => setActor(value as NestActor | '')} clearable disabled={saving} />
          </Form.Group>
          {actor === 'fixmystreet' && (
            <Form.Group className="mb-3" controlId="destruction-reference">
              <Form.Label>N° FixMyStreet <span className="text-muted fw-normal">facultatif</span></Form.Label>
              <Form.Control value={reference} maxLength={32} onChange={(event) => setReference(event.target.value)}
                disabled={saving} />
            </Form.Group>
          )}
          {!asReporter && (
            <Form.Group className="mb-3">
              <Form.Label>Moyens <span className="text-muted fw-normal">plusieurs possibles</span></Form.Label>
              <ChipChoice name="destruction-means" label="Moyens" options={MEANS} value={means} multiple
                onChange={(value) => setMeans(value as NestMeans[])} disabled={saving} />
            </Form.Group>
          )}
        </>
      )}

      <PhotoInput label={isVisit ? 'Photos' : 'Photo'} multiple onChange={setPhotos} disabled={saving} />

      {!asReporter && (
        <Form.Group className="mb-0 mt-3" controlId="nest-event-comments">
          <Form.Label>Commentaire</Form.Label>
          <Form.Control as="textarea" rows={2} value={comments} onChange={(event) => setComments(event.target.value)}
            placeholder={isVisit ? 'Accès, danger…' : ''} disabled={saving} />
        </Form.Group>
      )}

      {!asReporter && (!isVisit || outcome) && (
        <p className="small text-muted mt-3 mb-0">La personne qui a signalé ce nid sera prévenue.</p>
      )}
    </AppModal>
  );
}
