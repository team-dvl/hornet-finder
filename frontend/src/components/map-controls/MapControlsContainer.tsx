import LocateButton from './LocateButton';
import LayerControlsButton from './LayerControlsButton';
import QuickCaptureButton from './QuickCaptureButton';
import RadiusControl from './RadiusControl';
import { LoadingIndicator, ErrorAlert } from './MapFeedback';

interface MapControlsContainerProps {
  loading: boolean;
  error: string | null;
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
  onQuickHornetCapture?: () => void;
  canAddHornet?: boolean;
  searchRadius?: number;
  onRadiusChange?: (radius: number) => void;
  isAdmin?: boolean;
}

export default function MapControlsContainer({ 
  loading, 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onQuickHornetCapture,
  canAddHornet = false,
  searchRadius = 5,
  onRadiusChange,
  isAdmin = false
}: MapControlsContainerProps) {
  return (
    <>
      <div className="map-controls-container">
        <LocateButton 
          onLocationUpdate={onLocationUpdate} 
          onErrorUpdate={onErrorUpdate} 
        />
        {onRadiusChange && (
          <RadiusControl 
            currentRadius={searchRadius}
            onRadiusChange={onRadiusChange}
            maxRadius={isAdmin ? 20 : 5}
          />
        )}
        <LayerControlsButton 
          showApiariesButton={showApiariesButton}
          showNestsButton={showNestsButton}
        />
        {onQuickHornetCapture && (
          <QuickCaptureButton 
            onQuickCapture={onQuickHornetCapture} 
            canAddHornet={canAddHornet} 
          />
        )}
      </div>
      <LoadingIndicator loading={loading} />
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
