import { Button } from "react-bootstrap";

interface QuickCaptureButtonProps {
  onQuickCapture: () => void;
  canAddHornet: boolean;
}

export default function QuickCaptureButton({ onQuickCapture, canAddHornet }: QuickCaptureButtonProps) {
  // Vérifier si les APIs nécessaires sont supportées
  const isSupported = () => {
    return navigator.geolocation && window.DeviceOrientationEvent;
  };

  // Détecter iOS PWA
  const isIOSPWA = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window.navigator as any).standalone === true;
  };

  const handleClick = () => {
    if (isSupported()) {
      onQuickCapture();
    }
  };

  const supported = isSupported();
  const isPWA = isIOSPWA();

  return (
    <Button
      onClick={handleClick}
      variant="primary"
      size="sm"
      className="map-control-button"
      disabled={!supported}
      style={{ 
        backgroundColor: '#6f42c1', 
        borderColor: '#6f42c1', 
        opacity: 0.7, 
        borderRadius: '12px' 
      }}
      title={
        !supported 
          ? "Votre appareil ne supporte pas la capture automatique" 
          : !canAddHornet
          ? "Cliquer pour vous connecter et ajouter un frelon"
          : isPWA
          ? "Capture rapide avec boussole (iOS PWA) - Permissions requises"
          : "Capture rapide avec boussole - Position et direction automatiques"
      }
    >
      <span className="map-control-button-icon">🎯</span>
      <span className="map-control-button-text">Vol de frelon{isPWA ? ' PWA' : ''}</span>
    </Button>
  );
}
