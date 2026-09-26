/** Position of the device, for the manager lists (sort by distance, add where one stands). */

/** Current position, rounded to ~10 m: plenty to sort objects by distance. */
export function currentPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: Math.round(coords.latitude * 1e4) / 1e4,
        lon: Math.round(coords.longitude * 1e4) / 1e4,
      }),
      () => reject(new Error('Position indisponible : autorisez la géolocalisation pour trier par distance.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });
}
