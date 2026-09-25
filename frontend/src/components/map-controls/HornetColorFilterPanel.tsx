import { Button } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { ColorSelector, HelpTip } from '../common';
import { setColorFilters, clearColorFilters, selectColorFilters } from '../../store/slices/hornetsSlice';

/** Hornet filter by colour mark, a section of the layers sheet. */
export default function HornetColorFilterPanel() {
  const dispatch = useAppDispatch();
  const colorFilters = useAppSelector(selectColorFilters);
  const hasActiveFilters = Boolean(colorFilters.color1 || colorFilters.color2);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="fw-semibold d-inline-flex align-items-center">
          Marquage des frelons
          <HelpTip id="color-filter-help" title="Filtre par couleur">
            Seuls les frelons portant au moins une des couleurs choisies restent affichés ; ceux sans marquage
            sont masqués tant qu'un filtre est actif.
          </HelpTip>
        </span>
        {hasActiveFilters && (
          <Button variant="link" className="p-0" onClick={() => dispatch(clearColorFilters())}>
            Effacer
          </Button>
        )}
      </div>
      <div className="d-flex flex-column gap-2">
        <ColorSelector
          value={colorFilters.color1}
          onChange={(color) => dispatch(setColorFilters({ color1: color, color2: colorFilters.color2 }))}
        />
        <ColorSelector
          value={colorFilters.color2}
          onChange={(color) => dispatch(setColorFilters({ color1: colorFilters.color1, color2: color }))}
        />
      </div>
    </div>
  );
}
