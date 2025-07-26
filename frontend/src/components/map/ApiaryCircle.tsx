import { Circle } from 'react-leaflet';
import { Apiary } from '../../store/slices/apiariesSlice';

interface ApiaryCircleProps {
  apiary: Apiary;
}

export default function ApiaryCircle({ apiary }: ApiaryCircleProps) {
  return (
    <Circle
      center={[apiary.latitude, apiary.longitude]}
      radius={1000} // 1km en mètres
      pathOptions={{
        color: '#8B5CF6', // Violet pour un meilleur contraste
        fillColor: '#8B5CF6',
        fillOpacity: 0.1, // Très transparent
        weight: 2,
        opacity: 0.3, // Bordure semi-transparente
      }}
      // Pas d'événements onClick pour rendre non-cliquable
      eventHandlers={{}}
    />
  );
}
