import LocateButton from './LocateButton';
import LayerControlsButton from './LayerControlsButton';
import QuickCaptureButton from './QuickCaptureButton';
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
}

export default function MapControlsContainer({ 
  loading, 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onQuickHornetCapture,
  canAddHornet = false
}: MapControlsContainerProps) {
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
