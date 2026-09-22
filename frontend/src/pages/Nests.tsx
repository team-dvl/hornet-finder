import { InteractiveMap } from '../components/map';
import { NavbarComponent } from '../components/layout';

/** Nest-finding module: full-screen interactive map under the transparent navbar. */
export default function Nests() {
  return (
    <>
      <NavbarComponent />
      <div className="map-fullscreen">
        <InteractiveMap preset="nests" />
      </div>
    </>
  );
}
