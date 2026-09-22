import type { TrapEventKind } from '../../store/slices/trapsSlice';

/** Labels and icons of the journal entries, shared by the form and the timeline. */
export const EVENT_KINDS: { value: TrapEventKind; label: string; icon: string }[] = [
  { value: 'catch', label: 'Prise', icon: '🐝' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
  { value: 'cleaning', label: 'Nettoyage', icon: '🧽' },
  { value: 'refill', label: 'Recharge de consommable', icon: '🧪' },
  { value: 'repair', label: 'Réparation', icon: '🔧' },
  { value: 'installation', label: 'Installation', icon: '📌' },
  { value: 'removal', label: 'Retrait', icon: '📦' },
];

export function eventKindInfo(kind: TrapEventKind) {
  return EVENT_KINDS.find((entry) => entry.value === kind)
    ?? { value: kind, label: kind, icon: '•' };
}
