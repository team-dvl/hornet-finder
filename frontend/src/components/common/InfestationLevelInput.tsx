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

export default function InfestationLevelInput({ value, onChange, readOnly = false }: InfestationLevelInputProps) {
  const current = LEVELS.find(l => l.value === value) || LEVELS[0];

  if (readOnly) {
    // Badge coloré
    return (
      <Badge bg={current.color === 'orange' ? undefined : current.color} style={current.color === 'orange' ? { backgroundColor: '#fd7e14', color: 'white' } : {}}>
        {current.label}
      </Badge>
    );
  }

  // Dropdown coloré cohérent avec ColorSelector
  const getTextColor = (bg: string) => {
    // Contraste simple : blanc sur rouge/orange, noir sur jaune
    if (bg === '#fd7e14' || bg === '#dc3545') return 'white';
    return '#212529';
  };

  return (
    <Dropdown onSelect={key => onChange && onChange(key as InfestationLevel)}>
      <Dropdown.Toggle
        variant="outline-secondary"
        style={{
          backgroundColor: current.color === 'orange' ? '#fd7e14' : current.color === 'warning' ? '#ffc107' : current.color === 'danger' ? '#dc3545' : undefined,
          color: getTextColor(current.color === 'orange' ? '#fd7e14' : current.color === 'warning' ? '#ffc107' : current.color === 'danger' ? '#dc3545' : ''),
          border: current.color === 'warning' ? '1px solid #ccc' : undefined,
        }}
        className="d-flex align-items-center gap-2"
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: current.color === 'orange' ? '#fd7e14' : current.color === 'warning' ? '#ffc107' : current.color === 'danger' ? '#dc3545' : undefined,
            border: current.color === 'warning' ? '1px solid #ccc' : 'none',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        />
        <span>{current.label}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {LEVELS.map(l => (
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
                backgroundColor: l.color === 'orange' ? '#fd7e14' : l.color === 'warning' ? '#ffc107' : l.color === 'danger' ? '#dc3545' : undefined,
                border: l.color === 'warning' ? '1px solid #ccc' : 'none',
                borderRadius: '3px',
                flexShrink: 0,
              }}
            />
            <span>{l.label}</span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
