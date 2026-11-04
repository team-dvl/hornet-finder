import { Button } from 'react-bootstrap';

interface TriStateProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  disabled?: boolean;
}

/** A yes/no observation that may stay unanswered: a tap on the chosen answer clears it. */
export function TriState({ label, value, onChange, disabled }: TriStateProps) {
  const pick = (answer: boolean) => onChange(value === answer ? null : answer);
  return (
    <div className="obs-row">
      <span className="obs-label">{label}</span>
      <span className="visit-chips flex-shrink-0" role="group" aria-label={label}>
        <Button variant={value === true ? 'secondary' : 'outline-secondary'} aria-pressed={value === true}
          onClick={() => pick(true)} disabled={disabled}>Oui</Button>
        <Button variant={value === false ? 'secondary' : 'outline-secondary'} aria-pressed={value === false}
          onClick={() => pick(false)} disabled={disabled}>Non</Button>
      </span>
    </div>
  );
}

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: Record<T, string>;
  value: T | '';
  onChange: (value: T | '') => void;
  disabled?: boolean;
}

/** One answer among a few, as chips: a tap on the chosen one clears it. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, disabled }: ChoiceChipsProps<T>) {
  return (
    <div className="mb-2">
      <div className="obs-label mb-1">{label}</div>
      <div className="visit-chips" role="radiogroup" aria-label={label}>
        {(Object.entries(options) as [T, string][]).map(([option, text]) => (
          <Button key={option} variant={value === option ? 'secondary' : 'outline-secondary'}
            role="radio" aria-checked={value === option} disabled={disabled}
            onClick={() => onChange(value === option ? '' : option)}>
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}
