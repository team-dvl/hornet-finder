import { ToggleButton } from 'react-bootstrap';

interface ChipChoiceProps<T extends string> {
  /** Prefix of the ids of the chips */
  name: string;
  label: string;
  options: { value: T; label: string }[];
  /** One value (`multiple` false), or several */
  value: T | '' | T[];
  onChange: (value: T | '' | T[]) => void;
  multiple?: boolean;
  /** A second tap on the chosen chip clears it (an optional single choice) */
  clearable?: boolean;
  disabled?: boolean;
}

/** Chips instead of a dropdown: one choice, or several (`multiple`). */
export default function ChipChoice<T extends string>({
  name, label, options, value, onChange, multiple = false, clearable = false, disabled,
}: ChipChoiceProps<T>) {
  const chosen = (option: T) => (Array.isArray(value) ? value.includes(option) : value === option);
  const toggle = (option: T) => {
    if (Array.isArray(value)) {
      onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
    } else {
      onChange(value === option && clearable ? '' : option);
    }
  };
  return (
    <div className="d-flex flex-wrap gap-2" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={`${name}-${option.value}`}
          type="checkbox"
          variant="outline-primary"
          value={option.value}
          checked={chosen(option.value)}
          onChange={() => toggle(option.value)}
          className="rounded-pill"
          disabled={disabled}
        >
          {multiple && chosen(option.value) && <i className="bi bi-check-lg me-1" aria-hidden="true" />}
          {option.label}
        </ToggleButton>
      ))}
    </div>
  );
}
