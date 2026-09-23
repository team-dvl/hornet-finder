import { Button } from "react-bootstrap";

interface ScanTagButtonProps {
  onScanTag: () => void;
}

/** Opens the camera to scan the QR tag of a trap. */
export default function ScanTagButton({ onScanTag }: ScanTagButtonProps) {
  return (
    <Button
      onClick={onScanTag}
      variant="dark"
      size="sm"
      className="map-control-button"
      style={{
        opacity: 0.7,
        borderRadius: '12px'
      }}
      title="Scanner le QR Code d'un piège"
    >
      <span className="map-control-button-icon">📷</span>
      <span className="map-control-button-text">Scanner</span>
    </Button>
  );
}
