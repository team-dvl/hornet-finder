import LocateButton, { type CrosshairSource } from './LocateButton';
import LayerControlsButton from './LayerControlsButton';
import AddActionsButton from './AddActionsButton';
import { ErrorAlert } from './MapFeedback';

interface MapControlsContainerProps {
  error: string | null;
  onLocationUpdate: (coordinates: [number, number], source: CrosshairSource) => void;
  /** Where the crosshair was placed from, null while it is not on the map */
  crosshair?: CrosshairSource | null;
  onErrorUpdate: (error: string | null) => void;
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
  onShowNearestNests?: () => void;
  onQuickHornetCapture?: () => void;
  onAddTrap?: () => void;
  onScanTag?: () => void;
  /** A bar sits at the bottom of the map (trap move): the buttons go above it on a touch screen */
  raised?: boolean;
}

export default function MapControlsContainer({ 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onShowNearestNests,
  onQuickHornetCapture,
  onAddTrap,
  onScanTag,
  crosshair = null,
  raised = false,
}: MapControlsContainerProps) {
  // The quick capture needs the position and the compass
  const compassSupported = Boolean(navigator.geolocation && window.DeviceOrientationEvent);

  // At most three floating buttons: position, layers (with the filters) and add
  return (
    <>
      <div className={`map-controls-container${raised ? ' map-controls-raised' : ''}`}>
        <LocateButton 
          onLocationUpdate={onLocationUpdate} 
          onErrorUpdate={onErrorUpdate} 
        />
        <LayerControlsButton 
          showApiariesButton={showApiariesButton}
          showNestsButton={showNestsButton}
          onShowNearestNests={onShowNearestNests}
        />
        <AddActionsButton
          onQuickHornetCapture={compassSupported ? onQuickHornetCapture : undefined}
          onAddTrap={onAddTrap}
          onScanTag={onScanTag}
          crosshair={crosshair}
        />
      </div>
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
