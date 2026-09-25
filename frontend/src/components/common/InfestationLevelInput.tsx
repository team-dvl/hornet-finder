import { Badge } from 'react-bootstrap';

export type InfestationLevel = 'low' | 'moderate' | 'high';

const LEVELS: { value: InfestationLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Faible', color: 'warning' },
  { value: 'moderate', label: 'Modéré', color: 'orange' },
  { value: 'high', label: 'Fort', color: 'danger' },
];

interface InfestationLevelInputProps {
  value: InfestationLevel;
  onChange?: (level: InfestationLevel) => void;
  readOnly?: boolean;
}

// Centralise la logique de style pour tous les usages (badge, dropdown, pastille)
const getInfestationStyle = (color: string) => {
  switch (color) {
    case 'orange':
      return {
        backgroundColor: '#fd7e14',
        color: 'white',
        border: undefined,
        textColor: 'white',
      };
    case 'warning':
      return {
        backgroundColor: '#ffc107',
        color: '#212529',
        border: '1px solid #ccc',
        textColor: '#212529',
      };
    case 'danger':
      return {
        backgroundColor: '#dc3545',
        color: 'white',
        border: undefined,
        textColor: 'white',
      };
    default:
      return {};
  }
};

export default function InfestationLevelInput({ value, onChange, readOnly = false }: InfestationLevelInputProps) {
  const current = LEVELS.find(l => l.value === value) || LEVELS[0];
  const style = getInfestationStyle(current.color);

  if (readOnly) {
    // Badge coloré (mêmes couleurs que Dropdown)
    return (
      <Badge bg="none" style={{ backgroundColor: style.backgroundColor, color: style.color, border: style.border }}>
        {current.label}
      </Badge>
    );
  }

  // Three levels: a segmented control, every choice visible and one tap away
  return (
    <div className="d-flex gap-1" role="radiogroup" aria-label="Niveau d'infestation">
      {LEVELS.map((level) => {
        const levelStyle = getInfestationStyle(level.color);
        const selected = level.value === value;
        return (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className="btn flex-fill"
            style={selected
              ? { backgroundColor: levelStyle.backgroundColor, color: levelStyle.textColor, borderColor: levelStyle.backgroundColor }
              : { borderColor: levelStyle.backgroundColor, color: 'var(--bs-body-color)' }}
            onClick={() => onChange?.(level.value)}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
