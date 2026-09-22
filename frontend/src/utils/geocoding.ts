import axios from 'axios';

/**
 * Address lookup through Nominatim (OpenStreetMap).
 *
 * Nominatim asks for a low request rate and a meaningful identification, so
 * searches must be debounced by the caller and the results are limited to the
 * countries the platform covers.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const COUNTRY_CODES = 'be,fr,nl,lu,de';

export interface AddressSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

/** Address of a position, or an empty string when the lookup fails. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await axios.get(`${NOMINATIM}/reverse`, {
      params: { format: 'json', lat: latitude, lon: longitude, addressdetails: 1 },
      headers: { 'Accept-Language': 'fr' },
    });
    return response.data?.display_name ?? '';
  } catch {
    console.warn("Impossible de récupérer l'adresse automatiquement");
    return '';
  }
}

/** Positions matching a free-form address. Returns an empty list on failure. */
export async function searchAddress(query: string, limit = 5): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  try {
    const response = await axios.get(`${NOMINATIM}/search`, {
      params: { format: 'json', q: query, limit, countrycodes: COUNTRY_CODES },
      headers: { 'Accept-Language': 'fr' },
    });
    return (response.data as Array<{ display_name: string; lat: string; lon: string }>).map(
      (item) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      })
    );
  } catch {
    console.warn("La recherche d'adresse a échoué");
    return [];
  }
}
