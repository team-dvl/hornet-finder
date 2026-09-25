import React, { useState } from 'react';
import { Badge, Form } from 'react-bootstrap';
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
 * - En mode read-write : un bouton montrant la couleur choisie, qui déplie une
 *   grille de pastilles (tactile, sans menu flottant qui déborde sur un téléphone)
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

  // Mode read-write : bouton + grille de pastilles
  return (
    <ColorSwatchPicker
      value={selectedOption.value}
      onChange={onChange}
      disabled={disabled}
      label={label}
      size={size}
      className={className}
      style={style}
    />
  );
}

/** Round swatch of a colour; "no colour" is drawn as a crossed circle. */
function Swatch({ value, small = false }: { value: string; small?: boolean }) {
  const dimension = small ? '1.1rem' : '1.75rem';
  return (
    <span
      className="color-swatch"
      style={{
        width: dimension,
        height: dimension,
        backgroundColor: value ? getColorHex(value) : 'transparent',
      }}
      aria-hidden="true"
    >
      {!value && <i className="bi bi-slash-lg" />}
    </span>
  );
}

function ColorSwatchPicker({ value, onChange, disabled, label, size, className, style }: {
  value: string;
  onChange?: (value: string) => void;
  disabled: boolean;
  label?: string;
  size: 'sm' | 'md' | 'lg';
  className: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const current = COLOR_OPTIONS.find((option) => option.value === value) ?? COLOR_OPTIONS[0];

  return (
    <div className={className} style={style}>
      {label && <Form.Label className="small mb-1">{label}</Form.Label>}
      <button
        type="button"
        className={`form-control d-flex align-items-center gap-2 text-start ${size === 'sm' ? 'py-1' : ''}`}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
      >
        <Swatch value={current.value} small />
        <span className="text-truncate flex-grow-1">{current.label}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} small`} aria-hidden="true" />
      </button>
      {open && (
        <div className="color-swatch-grid mt-2" role="radiogroup" aria-label={label ?? 'Couleur'}>
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === current.value}
              aria-label={option.label}
              title={option.label}
              className={`color-swatch-button ${option.value === current.value ? 'selected' : ''}`}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
            >
              <Swatch value={option.value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
