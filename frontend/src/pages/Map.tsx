import { useSearchParams } from 'react-router-dom';
import { InteractiveMap } from '../components/map';
import { NavbarComponent } from '../components/layout';
import { isMapViewMode, safeReturnPath } from '../components/map/viewModes';

/**
 * Map module: the shared interactive map. Opened on an overview of the layers
 * by default; another module opens it in a view mode of its own through the
 * URL (`/map?view_mode=trap&trap=12&from=/traps`, see `mapUrl`).
 */
export default function MapPage() {
  const [params] = useSearchParams();
  const requested = params.get('view_mode');
  const viewMode = isMapViewMode(requested) ? requested : 'map';
  const trapId = Number(params.get('trap')) || null;

  return (
    <>
      <NavbarComponent />
      <div className="map-fullscreen">
        <InteractiveMap
          preset={viewMode}
          focusTrapId={trapId}
          returnTo={safeReturnPath(params.get('from'))}
        />
      </div>
    </>
  );
}
