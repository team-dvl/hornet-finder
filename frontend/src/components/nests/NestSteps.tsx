import type { Nest } from '../../store/store';
import { formatDate } from '../../utils/format';

/**
 * Where a nest stands among the three steps: reported, confirmed, neutralised.
 * Nothing for a rejected or abandoned nest: its badge says it all.
 */
export default function NestSteps({ nest }: { nest: Nest }) {
  const status = nest.status ?? 'reported';
  if (status === 'rejected' || status === 'abandoned') return null;
  const visit = nest.events?.find((event) => event.kind === 'visit' && event.outcome === 'active');
  const steps = [
    { key: 'reported', label: 'Signalé', done: true, date: nest.created_at },
    { key: 'confirmed', label: 'Confirmé', done: status === 'confirmed' || Boolean(visit), date: visit?.performed_at },
    { key: 'destroyed', label: 'Neutralisé', done: status === 'destroyed', date: nest.destroyed_at },
  ];
  return (
    <ol className="nest-steps" aria-label="Avancement">
      {steps.map((step) => (
        <li key={step.key} className={step.done ? `done step-${step.key}` : undefined}>
          <span>{step.label}</span>
          {step.done && step.date && <span className="text-muted">{formatDate(step.date)}</span>}
        </li>
      ))}
    </ol>
  );
}
