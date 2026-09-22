import { Hornet } from '../../store/slices/hornetsSlice';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import { Trap } from '../../store/slices/trapsSlice';

// Enumération pour les types d'objets
export enum MapObjectType {
  HORNET = 'hornet',
  APIARY = 'apiary', 
  NEST = 'nest',
  TRAP = 'trap'
}

// Interface pour un objet de la carte
export interface MapObject {
  id: number | string;
  type: MapObjectType;
  latitude: number;
  longitude: number;
  data: Hornet | Apiary | Nest | Trap;
  symbol: string;
  title: string;
  subtitle?: string;
  colors?: string[];
}
