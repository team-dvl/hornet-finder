import { InteractiveMap } from '../components/map';
import { NavbarComponent } from '../components/layout';

/** Trap module: the shared interactive map, opened on the trap layers. */
export default function Traps() {
  return (
    <>
      <NavbarComponent />
      <div className="map-fullscreen">
        <InteractiveMap preset="traps" />
      </div>
    </>
  );
}
