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

/**
 * Zoom maximum autorisé sur la carte
 * Utilisé pour permettre un zoom très rapproché pour séparer les objets superposés
 * Utilise l'interpolation au-delà du zoom natif 18 d'OpenStreetMap
 */
export const MAX_ZOOM = 21;

/**
 * Zoom natif maximum des tuiles OpenStreetMap
 * Au-delà de cette valeur, Leaflet interpolera les tuiles existantes
 */
export const MAX_NATIVE_ZOOM = 18;

/**
 * Distance en pixels pour considérer qu'il y a chevauchement d'objets sur la carte
 * Utilisé dans le système de détection de chevauchement pour déterminer
 * si plusieurs objets sont superposés au même endroit
 */
export const OVERLAP_THRESHOLD_PIXELS = 50;

/**
 * Zoom minimum requis pour tenter de séparer automatiquement les objets superposés
 * Si le zoom actuel est inférieur à cette valeur, le système tente un zoom automatique
 * pour séparer les objets, sinon il affiche le dialogue de sélection
 */
export const MIN_ZOOM_TO_SEPARATE = 18;
