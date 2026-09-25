import { Hornet } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAuth } from 'react-oidc-context';
import { ColorSelector } from '../../components/forms';
import { HORNET_RETURN_ZONE_ANGLE_DEG, HORNET_FLIGHT_SPEED_M_PER_MIN, HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M } from '../../utils/constants';
import { HelpTip } from '../common';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDate, formatDistance, formatDuration } from '../../utils/format';
import geomagnetism from "geomagnetism";
import CorrectedDirectionInfo from '../common/CorrectedDirectionInfo';

interface HornetReturnZoneInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
  clickPosition?: { lat: number; lng: number } | null; // Position cliquée sur la zone de retour
  onAddAtLocation?: (lat: number, lng: number) => void; // Prop pour déclencher l'ajout
  declination?: number | null; // Ajouté
  correctedDirection?: number | null; // Ajouté
}

// Calculer la distance estimée du nid basée sur la durée
function calculateNestDistance(duration?: number): number {
  if (!duration || duration <= 0) {
    return 2; // Distance max par défaut: 2km
  }
  // Calcul basé sur la vitesse du frelon
  const distanceInMeters = Math.round((duration / 60) * HORNET_FLIGHT_SPEED_M_PER_MIN);
  const finalDistance = Math.min(distanceInMeters, HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M);
  // Convertir en kilomètres
  return finalDistance / 1000;
}

export default function HornetReturnZoneInfoPopup({ 
  show, 
  onHide, 
  hornet, 
  clickPosition,
  onAddAtLocation,
  ...props // Récupérer les props supplémentaires (declination, correctedDirection)
}: HornetReturnZoneInfoPopupProps) {
  const { canAddHornet, canAddApiary } = useUserPermissions();
  const auth = useAuth();

  if (!hornet) {
    return null;
  }

  const calculatedDistance = calculateNestDistance(hornet.duration);
  const isBasedOnDuration = Boolean(hornet.duration && hornet.duration > 0);

  // Utiliser la position cliquée si disponible, sinon la position du frelon
  const displayPosition = clickPosition || { lat: hornet.latitude, lng: hornet.longitude };

  // Calcul de la déclinaison magnétique et direction corrigée
  let declination = props.declination;
  let correctedDirection = props.correctedDirection;
  if (declination == null || correctedDirection == null) {
    // geomagnetism attend [lng, lat]
    const geo = geomagnetism.model().point([hornet.longitude, hornet.latitude]);
    declination = geo.decl;
    correctedDirection = (hornet.direction ?? 0) + declination;
  }

  const canAddHere = auth.isAuthenticated && (canAddHornet || canAddApiary) && onAddAtLocation;

  return (
    <AppModal show={show} onHide={onHide} icon="🔺" title={`Zone de retour · frelon #${hornet.id}`}>
      <FieldRow label="Direction">
        <CorrectedDirectionInfo correctedDirection={correctedDirection} declination={declination} />
      </FieldRow>
      {hornet.duration ? <FieldRow label="Durée d'absence">{formatDuration(hornet.duration)}</FieldRow> : null}
      <FieldRow label={(
        <span className="d-inline-flex align-items-center">
          Longueur de la zone
          <HelpTip id={`zone-${hornet.id}-help`} title="Zone de retour">
            Triangle d'angle {HORNET_RETURN_ZONE_ANGLE_DEG}° dans la direction de vol.
            {isBasedOnDuration
              ? ` Sa longueur vient de la durée d'absence (${HORNET_FLIGHT_SPEED_M_PER_MIN} m par minute).`
              : " Sans durée d'absence mesurée, elle vaut 2 km par défaut."}
          </HelpTip>
        </span>
      )}>
        {formatDistance(calculatedDistance * 1000)}{!isBasedOnDuration && <span className="text-muted"> (par défaut)</span>}
      </FieldRow>
      {(hornet.mark_color_1 || hornet.mark_color_2) && (
        <FieldRow label="Marquage">
          <span className="d-inline-flex gap-1">
            <ColorSelector value={hornet.mark_color_1} readOnly />
            <ColorSelector value={hornet.mark_color_2} readOnly />
          </span>
        </FieldRow>
      )}
      {hornet.created_at && <FieldRow label="Observé le">{formatDate(hornet.created_at)}</FieldRow>}

      {canAddHere && (
        <div className="sheet-actions mt-3">
          <IconButton
            variant="outline-primary"
            icon={ACTION_ICONS.addHere}
            label="Ajouter à cette position"
            showLabel="always"
            onClick={() => onAddAtLocation(displayPosition.lat, displayPosition.lng)}
          />
        </div>
      )}
    </AppModal>
  );
}
