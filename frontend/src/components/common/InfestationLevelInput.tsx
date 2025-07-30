import { Badge, Dropdown } from 'react-bootstrap';

export type InfestationLevel = 'low' | 'moderate' | 'high';

const LEVELS: { value: InfestationLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Faible', color: 'warning' },
  { value: 'moderate', label: 'Modérée', color: 'orange' },
  { value: 'high', label: 'Forte', color: 'danger' },
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

  return (
    <Dropdown onSelect={key => onChange && onChange(key as InfestationLevel)}>
      <Dropdown.Toggle
        variant="outline-secondary"
        style={{
          backgroundColor: style.backgroundColor,
          color: style.textColor,
          border: style.border,
        }}
        className="d-flex align-items-center gap-2"
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: style.backgroundColor,
            border: style.border || 'none',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        />
        <span>{current.label}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {LEVELS.map(l => {
          const lStyle = getInfestationStyle(l.color);
          return (
            <Dropdown.Item
              eventKey={l.value}
              key={l.value}
              active={l.value === value}
              className="d-flex align-items-center gap-2"
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: lStyle.backgroundColor,
                  border: lStyle.border || 'none',
                  borderRadius: '3px',
                  flexShrink: 0,
                }}
              />
              <span>{l.label}</span>
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
}
