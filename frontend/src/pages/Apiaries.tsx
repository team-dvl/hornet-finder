import { InteractiveMap } from '../components/map';
import { NavbarComponent } from '../components/layout';

/** Apiary module: the shared interactive map, opened on the apiary layer. */
export default function Apiaries() {
  return (
    <>
      <NavbarComponent />
      <div className="map-fullscreen">
        <InteractiveMap preset="apiaries" />
      </div>
    </>
  );
}
