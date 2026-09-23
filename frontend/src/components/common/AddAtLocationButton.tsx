import { Button } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useUserPermissions } from '../../hooks/useUserPermissions';

interface AddAtLocationButtonProps {
  latitude: number;
  longitude: number;
  onAddAtLocation?: (lat: number, lng: number) => void;
  className?: string;
}

/**
 * Footer button of an object sheet that opens the add selector at the
 * object's position, so a second object can be placed at the same spot.
 * Hidden when the user cannot add anything.
 */
export default function AddAtLocationButton({
  latitude, longitude, onAddAtLocation, className = 'me-auto',
}: AddAtLocationButtonProps) {
  const auth = useAuth();
  const { canAddHornet, canAddApiary, canAddTrap, roles } = useUserPermissions();
  // Same rule as the add selector: any signed-in user with a role may report a nest
  const canAddNest = roles.length > 0;

  if (!auth.isAuthenticated || !onAddAtLocation) return null;
  if (!canAddHornet && !canAddApiary && !canAddNest && !canAddTrap) return null;

  return (
    <Button
      variant="outline-primary"
      onClick={() => onAddAtLocation(latitude, longitude)}
      className={className}
    >
      📍 Ajouter à cette position
    </Button>
  );
}
