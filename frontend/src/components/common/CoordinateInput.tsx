import { useState, useEffect, useRef } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

interface CoordinateInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
  placeholder?: string;
  precision?: number;
  labelPosition?: 'horizontal' | 'vertical' | 'auto';
}

interface DMSCoordinates {
  degrees: number;
  minutes: number;
  seconds: number;
}

export default function CoordinateInput({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder = "",
  precision = 6,
  labelPosition = 'auto'
}: CoordinateInputProps) {
  const [inputMode, setInputMode] = useState<'decimal' | 'dms'>('decimal');
  const [decimalValue, setDecimalValue] = useState(value.toString());
  const [dmsValue, setDmsValue] = useState<DMSCoordinates>({ degrees: 0, minutes: 0, seconds: 0 });
  const isInternalChange = useRef(false);

  // Convertir décimal vers DMS
  const decimalToDMS = (decimal: number): DMSCoordinates => {
    const absoluteDecimal = Math.abs(decimal);
    const degrees = Math.floor(absoluteDecimal);
    const minutesFloat = (absoluteDecimal - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;
    
    return {
      degrees: decimal < 0 ? -degrees : degrees,
      minutes,
      seconds: parseFloat(seconds.toFixed(4))
    };
  };

  // Convertir DMS vers décimal
  const dmsToDecimal = (dms: DMSCoordinates): number => {
    const { degrees, minutes, seconds } = dms;
    const absoluteDecimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
    return degrees < 0 ? -absoluteDecimal : absoluteDecimal;
  };

  // Synchroniser les valeurs quand la prop value change
  useEffect(() => {
    if (!isInternalChange.current) {
      setDecimalValue(value.toFixed(precision));
      setDmsValue(decimalToDMS(value));
    }
    isInternalChange.current = false;
  }, [value, precision]);

  // Gérer le changement de mode
  const toggleInputMode = () => {
    setInputMode(current => current === 'decimal' ? 'dms' : 'decimal');
  };

  // Gérer le changement de valeur décimale
  const handleDecimalChange = (newValue: string) => {
    setDecimalValue(newValue);
    const numericValue = parseFloat(newValue);
    if (!isNaN(numericValue)) {
      setDmsValue(decimalToDMS(numericValue));
      isInternalChange.current = true;
      onChange(numericValue);
    }
  };

  // Gérer le changement de valeur DMS
  const handleDMSChange = (field: keyof DMSCoordinates, newValue: string) => {
    const numericValue = parseFloat(newValue) || 0;
    const newDMS = { ...dmsValue, [field]: numericValue };
    setDmsValue(newDMS);
    
    const decimalResult = dmsToDecimal(newDMS);
    setDecimalValue(decimalResult.toFixed(precision));
    isInternalChange.current = true;
    onChange(decimalResult);
  };

  // Fonction pour parser les coordonnées DMS à partir de texte
  const parseDMSFromText = (text: string): DMSCoordinates | null => {
    // Patterns pour reconnaître différents formats DMS
    const dmsPatterns = [
      /(-?\d+)°\s*(\d+)['′]\s*(\d+(?:\.\d+)?)["″]/,  // DD°MM'SS"
      /(-?\d+)°\s*(\d+)['′]\s*(\d+(?:\.\d+)?)/,      // DD°MM'SS
      /(-?\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/,           // DD MM SS
      /(-?\d+)°(\d+)['′](\d+(?:\.\d+)?)["″]/,        // DD°MM'SS" (sans espaces)
    ];

    for (const pattern of dmsPatterns) {
      const match = text.trim().match(pattern);
      if (match) {
        const degrees = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseFloat(match[3]);
        
        // Validation des valeurs
        if (minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
          return { degrees, minutes, seconds };
        }
      }
    }
    return null;
  };

  // Fonction pour parser les coordonnées décimales à partir de texte
  const parseDecimalFromText = (text: string): number | null => {
    const cleaned = text.trim();
    const decimal = parseFloat(cleaned);
    if (!isNaN(decimal) && !cleaned.includes('°') && !cleaned.includes('′') && !cleaned.includes('″')) {
      return decimal;
    }
    return null;
  };

  // Gérer le collage intelligent
  const handleSmartPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Essayer de parser en DMS d'abord
    const dmsCoords = parseDMSFromText(pastedText);
    if (dmsCoords) {
      // Format DMS détecté
      setDmsValue(dmsCoords);
      const decimalResult = dmsToDecimal(dmsCoords);
      setDecimalValue(decimalResult.toFixed(precision));
      isInternalChange.current = true;
      onChange(decimalResult);
      
      // Basculer vers DMS si on n'y est pas déjà
      if (inputMode === 'decimal') {
        setInputMode('dms');
      }
      return;
    }
    
    // Essayer de parser en décimal
    const decimalCoord = parseDecimalFromText(pastedText);
    if (decimalCoord !== null) {
      // Format décimal détecté
      setDecimalValue(decimalCoord.toFixed(precision));
      setDmsValue(decimalToDMS(decimalCoord));
      isInternalChange.current = true;
      onChange(decimalCoord);
      
      // Basculer vers décimal si on n'y est pas déjà
      if (inputMode === 'dms') {
        setInputMode('decimal');
      }
      return;
    }
    
    // Si aucun format reconnu, laisser le comportement par défaut se produire
    console.warn('Format de coordonnées non reconnu:', pastedText);
  };

  // Mode lecture seule
  if (readOnly) {
    const readOnlyControls = (
      <div className="d-flex align-items-center gap-2">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={toggleInputMode}
          style={{ 
            fontSize: '0.75rem', 
            padding: '0.15rem ',
            minWidth: '35px'
          }}
          title={inputMode === 'decimal' ? 'Afficher en degrés-minutes-secondes' : 'Afficher en décimal'}
        >
          {inputMode === 'decimal' ? 'dec' : 'dms'}
        </Button>
        
        <span 
          className="user-select-all text-monospace"
          style={{ 
            fontSize: '0.875rem',
            cursor: 'text'
          }}
        >
            {inputMode === 'decimal' 
            ? value.toFixed(precision)
            : `${dmsValue.degrees}°\u00A0${dmsValue.minutes}′\u00A0${dmsValue.seconds.toFixed(2)}″`
            }
        </span>
      </div>
    );

    return (
      <div className={`d-flex ${labelPosition === 'vertical' ? 'flex-column' : labelPosition === 'auto' ? 'flex-column flex-md-row' : 'flex-row'} ${labelPosition !== 'vertical' ? 'align-items-center' : 'align-items-start'} gap-2`}>
        <div className={`${labelPosition === 'horizontal' ? 'col-form-label' : ''} fw-medium text-nowrap`} style={{ minWidth: labelPosition === 'horizontal' ? '120px' : 'auto' }}>
          {label}
        </div>
        <div className="flex-grow-1">
          {readOnlyControls}
        </div>
      </div>
    );
  }

  const inputControls = (
    <div className="d-flex align-items-start">
      <InputGroup style={{ width: 'auto', maxWidth: 'fit-content' }}>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={toggleInputMode}
          style={{ 
            fontSize: '0.75rem', 
            padding: '0.25rem 0.5rem',
            minWidth: '40px'
          }}
          title={inputMode === 'decimal' ? 'Passer en degrés-minutes-secondes' : 'Passer en décimal'}
        >
          {inputMode === 'decimal' ? 'dec' : 'dms'}
        </Button>
        
        {inputMode === 'decimal' ? (
          <Form.Control
            type="number"
            step={`0.${'0'.repeat(precision - 1)}1`}
            value={decimalValue}
            onChange={(e) => handleDecimalChange(e.target.value)}
            onPaste={handleSmartPaste}
            placeholder={placeholder}
            inputMode="decimal"
            style={{ width: '140px' }} // Espace pour 8 chiffres + point + signe
          />
        ) : (
          <>
            {/* Version horizontale pour écrans suffisamment larges */}
            <div className="d-flex flex-nowrap gap-1 d-none d-sm-flex">
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="1"
                  value={dmsValue.degrees}
                  onChange={(e) => handleDMSChange('degrees', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="°"
                  inputMode="numeric"
                  style={{ width: '55px' }} // 3 chiffres + signe
                  size="sm"
                />
                <span className="ms-1 text-muted small">°</span>
              </div>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="1"
                  min="0"
                  max="59"
                  value={dmsValue.minutes}
                  onChange={(e) => handleDMSChange('minutes', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="′"
                  inputMode="numeric"
                  style={{ width: '60px' }} // 2 chiffres + contrôles up/down
                  size="sm"
                />
                <span className="ms-1 text-muted small">′</span>
              </div>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  max="59.99"
                  value={dmsValue.seconds}
                  onChange={(e) => handleDMSChange('seconds', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="″"
                  inputMode="decimal"
                  style={{ width: '85px' }} // 6 chiffres + point + contrôles up/down
                  size="sm"
                />
                <span className="ms-1 text-muted small">″</span>
              </div>
            </div>
            
            {/* Version verticale pour petits écrans */}
            <div className="d-flex flex-column gap-2 d-sm-none">
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="1"
                  value={dmsValue.degrees}
                  onChange={(e) => handleDMSChange('degrees', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="Degrés"
                  inputMode="numeric"
                  style={{ width: '100px' }}
                  size="sm"
                />
                <span className="ms-2 text-muted">°</span>
              </div>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="1"
                  min="0"
                  max="59"
                  value={dmsValue.minutes}
                  onChange={(e) => handleDMSChange('minutes', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="Minutes"
                  inputMode="numeric"
                  style={{ width: '100px' }}
                  size="sm"
                />
                <span className="ms-2 text-muted">′</span>
              </div>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  max="59.99"
                  value={dmsValue.seconds}
                  onChange={(e) => handleDMSChange('seconds', e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="Secondes"
                  inputMode="decimal"
                  style={{ width: '100px' }}
                  size="sm"
                />
                <span className="ms-2 text-muted">″</span>
              </div>
            </div>
          </>
        )}
      </InputGroup>
      {/* Ressort invisible pour pousser le contenu vers la gauche */}
      <div style={{ flex: 1 }}></div>
    </div>
  );

  return (
    <div className={`d-flex ${labelPosition === 'vertical' ? 'flex-column' : labelPosition === 'auto' ? 'flex-column flex-md-row' : 'flex-row'} ${labelPosition !== 'vertical' ? 'align-items-center' : 'align-items-start'} gap-2`}>
      <div className={`${labelPosition === 'horizontal' ? 'col-form-label' : ''} fw-medium text-nowrap`} style={{ minWidth: labelPosition === 'horizontal' ? '120px' : 'auto' }}>
        {label}
      </div>
      <div className="flex-grow-1">
        {inputControls}
      </div>
    </div>
  );
}
