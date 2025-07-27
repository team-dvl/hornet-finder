import { useState } from 'react';
import ColorSelector from './ColorSelector';
import { COLOR_OPTIONS } from '../../utils/colors';

export default function ColorSelectorPreview() {
  const [testColor, setTestColor] = useState('red');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Aperçu du composant ColorSelector</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Mode Read-Write</h3>
        <ColorSelector
          value={testColor}
          onChange={setTestColor}
          label="Choisissez une couleur"
          size="md"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Mode Read-Only</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {COLOR_OPTIONS.filter(c => c.value !== '').map(color => (
            <ColorSelector
              key={color.value}
              value={color.value}
              readOnly
              size="sm"
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Couleur sélectionnée actuellement</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Couleur :</span>
          <ColorSelector value={testColor} readOnly size="sm" />
        </div>
      </div>
    </div>
  );
}
