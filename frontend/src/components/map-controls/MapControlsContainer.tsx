import LocateButton from './LocateButton';
import LayerControlsButton from './LayerControlsButton';
import AddActionsButton from './AddActionsButton';
import { ErrorAlert } from './MapFeedback';

interface MapControlsContainerProps {
  error: string | null;
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
  onQuickHornetCapture?: () => void;
  onAddTrap?: () => void;
  onScanTag?: () => void;
}

export default function MapControlsContainer({ 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onQuickHornetCapture,
  onAddTrap,
  onScanTag
}: MapControlsContainerProps) {
  // The quick capture needs the position and the compass
  const compassSupported = Boolean(navigator.geolocation && window.DeviceOrientationEvent);

  // At most three floating buttons: position, layers (with the filters) and add
  return (
    <>
      <div className="map-controls-container">
        <LocateButton 
          onLocationUpdate={onLocationUpdate} 
          onErrorUpdate={onErrorUpdate} 
        />
        <LayerControlsButton 
          showApiariesButton={showApiariesButton}
          showNestsButton={showNestsButton}
        />
        <AddActionsButton
          onQuickHornetCapture={compassSupported ? onQuickHornetCapture : undefined}
          onAddTrap={onAddTrap}
          onScanTag={onScanTag}
        />
      </div>
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
