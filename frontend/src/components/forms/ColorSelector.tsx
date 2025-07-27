import React from 'react';
import { Badge, Dropdown, Form } from 'react-bootstrap';
import { COLOR_OPTIONS, getColorHex } from '../../utils/colors';
import { getTextColorCSS } from '../../utils/textReadability';

export interface ColorSelectorProps {
  /** Valeur actuelle de la couleur */
  value?: string;
  /** Fonction appelée quand la couleur change (mode read-write seulement) */
  onChange?: (value: string) => void;
  /** Si true, le composant est en lecture seule (Badge) */
  readOnly?: boolean;
  /** Si true, le composant est désactivé */
  disabled?: boolean;
  /** Label affiché au-dessus du composant (mode read-write) */
  label?: string;
  /** Taille du composant */
  size?: 'sm' | 'md' | 'lg';
  /** Classe CSS supplémentaire */
  className?: string;
  /** Style supplémentaire */
  style?: React.CSSProperties;
}

/**
 * Composant unifié pour afficher et sélectionner des couleurs.
 * - En mode read-only : affiche un Badge coloré avec le texte de la couleur
 * - En mode read-write : affiche un Dropdown pour sélectionner une couleur
 */
export default function ColorSelector({
  value = '',
  onChange,
  readOnly = false,
  disabled = false,
  label,
  size = 'md',
  className = '',
  style = {},
}: ColorSelectorProps) {
  const selectedOption = COLOR_OPTIONS.find(option => option.value === value) || COLOR_OPTIONS[0];
  const colorHex = getColorHex(selectedOption.value);
  const textColor = getTextColorCSS(colorHex);

  // Mode read-only : Badge coloré
  if (readOnly) {
    // Ne rien afficher si pas de couleur
    if (!value || value === '') {
      return null;
    }

    const badgeStyle = {
      backgroundColor: colorHex,
      color: textColor,
      border: selectedOption.value === 'white' || selectedOption.value === '' ? '1px solid #ccc' : 'none',
      ...style,
    };

    return (
      <Badge 
        bg="" // Pas de couleur Bootstrap par défaut
        className={`${className}`}
        style={badgeStyle}
      >
        {selectedOption.label}
      </Badge>
    );
  }

  // Mode read-write : Dropdown
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  };

  const minWidths = {
    sm: '120px',
    md: '140px',
    lg: '160px'
  };

  return (
    <div className={className} style={style}>
      {label && (
        <Form.Label className={`small mb-1 ${size === 'sm' ? 'mb-1' : 'mb-2'}`}>
          {label}:
        </Form.Label>
      )}
      <Dropdown>
        <Dropdown.Toggle
          variant="outline-secondary"
          className={`d-flex align-items-center gap-2 w-100 ${sizeClasses[size]}`}
          disabled={disabled}
          style={{ minWidth: minWidths[size] }}
        >
          <div 
            style={{
              width: size === 'sm' ? '14px' : size === 'lg' ? '20px' : '16px',
              height: size === 'sm' ? '14px' : size === 'lg' ? '20px' : '16px',
              backgroundColor: colorHex,
              border: selectedOption.value === 'white' || selectedOption.value === '' ? '1px solid #ccc' : 'none',
              borderRadius: '3px',
              flexShrink: 0,
            }}
          />
          <span className="text-truncate">{selectedOption.label}</span>
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ maxHeight: '200px', overflowY: 'auto', minWidth: minWidths[size] }}>
          {COLOR_OPTIONS.map(color => (
            <Dropdown.Item
              key={color.value}
              onClick={() => onChange?.(color.value)}
              className="d-flex align-items-center gap-2"
              active={color.value === selectedOption.value}
            >
              <div 
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: getColorHex(color.value),
                  border: color.value === 'white' || color.value === '' ? '1px solid #ccc' : 'none',
                  borderRadius: '3px',
                  flexShrink: 0,
                }}
              />
              <span>{color.label}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
