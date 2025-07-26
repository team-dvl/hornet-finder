import { Apiary } from '../store/slices/apiariesSlice';
import { APIARY_CIRCLE_RADIUS_M } from './constants';

/**
 * Calcule la distance entre deux points géographiques en mètres
 * Utilise la formule de Haversine pour le calcul de distance sur sphère
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Détermine si un point (coordonnées de clic) est à l'intérieur d'un cercle de rucher
 */
function pointInCircle(clickLat: number, clickLon: number, apiary: Apiary): boolean {
  const distance = calculateDistance(clickLat, clickLon, apiary.latitude, apiary.longitude);
  return distance <= APIARY_CIRCLE_RADIUS_M;
}

/**
 * Trouve tous les ruchers dont les cercles contiennent le point cliqué
 * Ne considère QUE les cercles qui contiennent directement le point de clic,
 * pas ceux qui se chevauchent ailleurs
 */
export function findOverlappingCircles(
  clickLat: number, 
  clickLon: number, 
  apiaries: Apiary[]
): number[] {
  // Trouver SEULEMENT les cercles qui contiennent le point cliqué
  const directlyClickedApiaries = apiaries.filter(apiary => 
    apiary.id && pointInCircle(clickLat, clickLon, apiary)
  );

  // Retourner seulement les IDs des cercles qui contiennent le point de clic
  return directlyClickedApiaries
    .map(apiary => apiary.id)
    .filter((id): id is number => id !== undefined);
}
