import { Button } from "react-bootstrap";

interface AddTrapButtonProps {
  onAddTrap: () => void;
}

/**
 * Shortcut to place a trap without picking a spot on the map first: the form
 * opens on the current map centre and offers an address search.
 */
export default function AddTrapButton({ onAddTrap }: AddTrapButtonProps) {
  return (
    <Button
      onClick={onAddTrap}
      variant="primary"
      size="sm"
      className="map-control-button"
      style={{
        backgroundColor: '#0d6efd',
        borderColor: '#0d6efd',
        opacity: 0.7,
        borderRadius: '12px'
      }}
      title="Ajouter un piège, par adresse ou à la position courante"
    >
      <span className="map-control-button-icon">🪤</span>
      <span className="map-control-button-text">Piège</span>
    </Button>
  );
}
