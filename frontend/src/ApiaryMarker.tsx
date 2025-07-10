import { Marker, Popup } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { Apiary } from './store/slices/apiariesSlice';

// Couleurs selon le niveau d'infestation
const getInfestationColor = (level: 1 | 2 | 3): string => {
  switch (level) {
    case 1: return '#ffc107'; // Jaune - Infestation faible (Light)
    case 2: return '#fd7e14'; // Orange - Infestation modérée (Medium)
    case 3: return '#dc3545'; // Rouge - Infestation élevée (High)
    default: return '#6c757d'; // Gris - Inconnu
  }
};

// Créer une icône personnalisée avec le niveau d'infestation
const createApiaryIcon = (infestationLevel: 1 | 2 | 3) => {
  const color = getInfestationColor(infestationLevel);
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" font-size="16" fill="white">🐝</text>
    </svg>
  `;
  
  return new DivIcon({
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: 'apiary-icon'
  });
};

const getInfestationText = (level: 1 | 2 | 3): string => {
  switch (level) {
    case 1: return 'Infestation faible';
    case 2: return 'Infestation modérée';
    case 3: return 'Infestation élevée';
    default: return 'Niveau inconnu';
  }
};

interface ApiaryMarkerProps {
  apiary: Apiary;
  onClick?: (apiary: Apiary) => void;
}

export default function ApiaryMarker({ apiary, onClick }: ApiaryMarkerProps) {
  const handleMarkerClick = () => {
    if (onClick) {
      onClick(apiary);
    }
  };

  return (
    <Marker
      position={[apiary.latitude, apiary.longitude]}
      icon={createApiaryIcon(apiary.infestation_level)}
      eventHandlers={{
        click: handleMarkerClick,
      }}
    >
      <Popup>
        <div className="p-2" style={{ minWidth: '200px' }}>
          <h6 className="mb-2 text-center">
            🐝 Rucher #{apiary.id}
          </h6>
          
          <div className="mb-2">
            <strong>Niveau d'infestation :</strong>
            <div 
              className="badge ms-2 px-2 py-1"
              style={{ 
                backgroundColor: getInfestationColor(apiary.infestation_level),
                color: 'white'
              }}
            >
              {getInfestationText(apiary.infestation_level)}
            </div>
          </div>
          
          <div className="mb-2">
            <strong>Coordonnées :</strong>
            <div className="small text-muted">
              Lat: {apiary.latitude.toFixed(6)}
              <br />
              Lng: {apiary.longitude.toFixed(6)}
            </div>
          </div>
          
          {apiary.comments && (
            <div className="mb-2">
              <strong>Commentaires :</strong>
              <div className="small">{apiary.comments}</div>
            </div>
          )}
          
          {apiary.created_at && (
            <div className="mb-2">
              <strong>Créé le :</strong>
              <div className="small text-muted">
                {new Date(apiary.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          )}
          
          {apiary.created_by && (
            <div>
              <strong>Créé par :</strong>
              <div className="small text-muted">{apiary.created_by}</div>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
