import { Form } from 'react-bootstrap';
import { AFSCA_EXAMPLE, afscaInputIsValid, formatAfscaPartial } from '../../utils/afsca';

interface AfscaNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Value recorded before the format was enforced: accepted unchanged */
  initialValue?: string;
  disabled?: boolean;
}

/**
 * Field of an AFSCA number: digits only (numeric keypad on a phone), the dots
 * of `X.XXX.XXX.XXX` inserted while typing. Takes its id from the
 * surrounding `Form.Group controlId`.
 */
export default function AfscaNumberInput({ value, onChange, initialValue = '', disabled }: AfscaNumberInputProps) {
  const invalid = !afscaInputIsValid(value, initialValue);
  return (
    <>
      <Form.Control
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={AFSCA_EXAMPLE}
        value={value}
        isInvalid={invalid}
        onChange={(event) => onChange(formatAfscaPartial(event.target.value))}
        disabled={disabled}
      />
      <Form.Control.Feedback type="invalid">10 chiffres : {AFSCA_EXAMPLE}</Form.Control.Feedback>
    </>
  );
}
