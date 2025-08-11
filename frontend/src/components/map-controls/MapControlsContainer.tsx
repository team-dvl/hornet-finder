import LocateButton from './LocateButton';
import LayerControlsButton from './LayerControlsButton';
import QuickCaptureButton from './QuickCaptureButton';
import HornetColorFilterButton from './HornetColorFilterButton';
import { ErrorAlert } from './MapFeedback';
import { useAppSelector, selectShowHornets } from '../../store/store';

interface MapControlsContainerProps {
  error: string | null;
  onLocationUpdate: (coordinates: [number, number]) => void;
  onErrorUpdate: (error: string | null) => void;
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
  onQuickHornetCapture?: () => void;
  canAddHornet?: boolean;
}

export default function MapControlsContainer({ 
  error, 
  onLocationUpdate, 
  onErrorUpdate, 
  showApiariesButton = false, 
  showNestsButton = false,
  onQuickHornetCapture,
  canAddHornet = false
}: MapControlsContainerProps) {
  const showHornets = useAppSelector(selectShowHornets);

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
        {/* Bouton de filtrage par couleur - visible uniquement si les frelons sont affichés */}
        {showHornets && <HornetColorFilterButton />}
        {onQuickHornetCapture && (
          <QuickCaptureButton 
            onQuickCapture={onQuickHornetCapture} 
            canAddHornet={canAddHornet} 
          />
        )}
      </div>
      <ErrorAlert error={error} onClose={() => onErrorUpdate(null)} />
    </>
  );
}
