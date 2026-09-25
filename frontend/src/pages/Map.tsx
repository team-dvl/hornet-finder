import { InteractiveMap } from '../components/map';
import { NavbarComponent } from '../components/layout';

/** Map module: the shared interactive map, opened on an overview of the layers. */
export default function MapPage() {
  return (
    <>
      <NavbarComponent />
      <div className="map-fullscreen">
        <InteractiveMap preset="map" />
      </div>
    </>
  );
}
