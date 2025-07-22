// Constantes globales de l'application Hornet Finder

/**
 * Angle de dispersion pour la zone de retour du frelon (en degrés)
 * Cette valeur détermine l'ouverture du cône triangulaire qui représente
 * la zone probable du nid basée sur la direction de vol observée
 */
export const HORNET_RETURN_ZONE_ANGLE_DEG = 6;

/**
 * Distance maximale par défaut pour la zone de retour (en kilomètres)
 * Utilisée quand aucune durée d'absence n'est observée
 */
export const HORNET_RETURN_ZONE_MAX_DISTANCE_KM = 2;

/**
 * Distance maximale absolue pour la zone de retour (en mètres)
 * Limite supérieure même avec une durée d'absence très longue
 */
export const HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M = 3000;

/**
 * Vitesse estimée du frelon lors du retour au nid (en mètres par minute)
 * Utilisée pour calculer la distance probable du nid basée sur la durée d'absence
 */
export const HORNET_FLIGHT_SPEED_M_PER_MIN = 100;

/**
 * Géolocalisation par défaut de l'application (région de Namur, Belgique)
 * Utilisée comme centre de carte et position utilisateur par défaut
 */
export const DEFAULT_GEOLOCATION = {
  latitude: 50.491064,
  longitude: 4.884473
};

/**
 * Rayon de recherche maximum par défaut (en kilomètres)
 * Utilisé pour limiter la zone de recherche des éléments sur la carte
 */
export const DEFAULT_MAX_SEARCH_RADIUS_KM = 5;


/**
 * Facteur de zoom par défaut pour la carte
 * Utilisé pour initialiser la vue de la carte
 */
export const DEFAULT_ZOOMFACTOR = 15;
