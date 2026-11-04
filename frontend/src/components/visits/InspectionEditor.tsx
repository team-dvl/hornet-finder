import { Form } from 'react-bootstrap';
import { MarkdownEditor } from '../common';
import { countLabel } from '../../utils/coloniesApi';
import type { BarFamily } from '../../utils/hivesApi';
import {
  ACTIVITY_LABELS, FEEDING_LABELS, HORNET_LABELS, TEMPER_LABELS, type Inspection,
} from '../../utils/visitsApi';
import { ChoiceChips, TriState } from './controls';

interface InspectionEditorProps {
  inspection: Inspection;
  family: BarFamily;
  onChange: (inspection: Inspection) => void;
  disabled?: boolean;
  idPrefix: string;
}

/** What was seen of one colony: every observation optional, the notes last. */
export default function InspectionEditor({ inspection, family, onChange, disabled, idPrefix }: InspectionEditorProps) {
  const set = <K extends keyof Inspection>(name: K, value: Inspection[K]) => onChange({ ...inspection, [name]: value });
  const count = countLabel(family);

  return (
    <div>
      <TriState label="Reine vue" value={inspection.queen_seen} onChange={(v) => set('queen_seen', v)} disabled={disabled} />
      <TriState label="Œufs" value={inspection.eggs_seen} onChange={(v) => set('eggs_seen', v)} disabled={disabled} />
      <TriState label="Couvain" value={inspection.brood_seen} onChange={(v) => set('brood_seen', v)} disabled={disabled} />
      <TriState label="Cellules royales" value={inspection.queen_cells} onChange={(v) => set('queen_cells', v)} disabled={disabled} />
      <ChoiceChips label="Comportement" options={TEMPER_LABELS} value={inspection.temper}
        onChange={(v) => set('temper', v)} disabled={disabled} />
      <ChoiceChips label="Activité au trou de vol" options={ACTIVITY_LABELS} value={inspection.activity}
        onChange={(v) => set('activity', v)} disabled={disabled} />
      <TriState label="Entrée de pollen" value={inspection.pollen} onChange={(v) => set('pollen', v)} disabled={disabled} />
      <ChoiceChips label="Frelons devant l'entrée" options={HORNET_LABELS} value={inspection.hornets}
        onChange={(v) => set('hornets', v)} disabled={disabled} />
      <TriState label="Muselière en place" value={inspection.entrance_guard}
        onChange={(v) => set('entrance_guard', v)} disabled={disabled} />
      <ChoiceChips label="Nourrissage" options={FEEDING_LABELS} value={inspection.feeding}
        onChange={(v) => onChange({
          ...inspection, feeding: v,
          ...(v ? { feeding_unit: inspection.feeding_unit || 'l' } : { feeding_amount: null, feeding_unit: '' }),
        })}
        disabled={disabled} />
      {inspection.feeding && (
        <div className="d-flex gap-2 mb-2">
          <Form.Control
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            aria-label="Quantité"
            placeholder="Quantité"
            value={inspection.feeding_amount ?? ''}
            disabled={disabled}
            onChange={(event) => set('feeding_amount', event.target.value || null)}
          />
          <Form.Select
            className="flex-shrink-0 w-auto"
            aria-label="Unité"
            value={inspection.feeding_unit || 'l'}
            disabled={disabled}
            onChange={(event) => set('feeding_unit', event.target.value as Inspection['feeding_unit'])}
          >
            <option value="l">L</option>
            <option value="kg">kg</option>
          </Form.Select>
        </div>
      )}
      {count && (
        <Form.Group className="mb-2" controlId={`${idPrefix}-bars`}>
          <Form.Label className="obs-label mb-1">{count} après la visite</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={0} value={inspection.bars ?? ''} disabled={disabled}
            onChange={(event) => set('bars', event.target.value === '' ? null : Number(event.target.value))} />
        </Form.Group>
      )}
      <div className="mb-1">
        <MarkdownEditor id={`${idPrefix}-notes`} rows={3} value={inspection.notes} disabled={disabled}
          onChange={(notes) => set('notes', notes)} label={<span className="obs-label">Notes</span>} />
      </div>
    </div>
  );
}
