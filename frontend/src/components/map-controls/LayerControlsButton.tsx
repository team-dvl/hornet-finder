import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useAuth } from 'react-oidc-context';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import {
  toggleHornets,
  selectShowHornets,
  toggleReturnZones,
  selectShowReturnZones,
  toggleApiaries,
  selectShowApiaries,
  toggleApiaryCircles,
  selectShowApiaryCircles,
  toggleNests,
  selectShowNests,
  toggleShowArchivedHornets,
  selectShowArchivedHornets,
  toggleShowArchivedNests,
  selectShowArchivedNests,
  toggleTraps,
  selectShowTraps,
  toggleInactiveTraps,
  selectShowInactiveTraps,
  toggleOnlyMyTraps,
  selectOnlyMyTraps
} from '../../store/store';
import { selectColorFilters } from '../../store/slices/hornetsSlice';
import { BottomSheet } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import HornetColorFilterPanel from './HornetColorFilterPanel';
import BulkArchivePanel from './BulkArchivePanel';

interface LayerControlsButtonProps {
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
}

/** One layer switch; `sub` indents an option of the layer above. */
function LayerSwitch({ id, icon, label, checked, onChange, sub = false }: {
  id: string;
  icon: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  sub?: boolean;
}) {
  return (
    <label htmlFor={id} className={`layer-switch ${sub ? 'layer-switch-sub' : ''}`}>
      <span className="me-2" aria-hidden="true">{icon}</span>
      <span className="flex-grow-1">{label}</span>
      <Form.Check type="switch" id={id} checked={checked} onChange={onChange} className="mb-0" />
    </label>
  );
}

/** Map button opening the layers sheet: layers, hornet colour filter, archives. */
export default function LayerControlsButton({ 
  showApiariesButton = false, 
  showNestsButton = false 
}: LayerControlsButtonProps) {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { isAdmin } = useUserPermissions();
  
  const showHornets = useAppSelector(selectShowHornets);
  const showReturnZones = useAppSelector(selectShowReturnZones);
  const showApiaries = useAppSelector(selectShowApiaries);
  const showApiaryCircles = useAppSelector(selectShowApiaryCircles);
  const showNests = useAppSelector(selectShowNests);
  const showArchivedHornets = useAppSelector(selectShowArchivedHornets);
  const showArchivedNests = useAppSelector(selectShowArchivedNests);
  const showTraps = useAppSelector(selectShowTraps);
  const showInactiveTraps = useAppSelector(selectShowInactiveTraps);
  const onlyMyTraps = useAppSelector(selectOnlyMyTraps);
  const colorFilters = useAppSelector(selectColorFilters);
  const filtered = showHornets && Boolean(colorFilters.color1 || colorFilters.color2);

  return (
    <>
      <button
        type="button"
        className="map-fab"
        onClick={() => setOpen(true)}
        aria-label="Couches"
        title="Couches affichées"
      >
        <i className="bi bi-layers" aria-hidden="true" />
        {filtered && <span className="map-fab-dot" title="Filtre de couleur actif" />}
      </button>

      <BottomSheet show={open} onHide={() => setOpen(false)} title="Couches">
        <LayerSwitch id="layer-hornets" icon={OBJECT_ICONS.hornet} label="Frelons" checked={showHornets} onChange={() => dispatch(toggleHornets())} />
        {showHornets && (
          <LayerSwitch id="layer-zones" icon="🔺" label="Zones de retour" checked={showReturnZones} onChange={() => dispatch(toggleReturnZones())} sub />
        )}
        {showNestsButton && (
          <LayerSwitch id="layer-nests" icon={OBJECT_ICONS.nest} label="Nids" checked={showNests} onChange={() => dispatch(toggleNests())} />
        )}
        {showApiariesButton && (
          <LayerSwitch id="layer-apiaries" icon={OBJECT_ICONS.apiary} label="Ruchers" checked={showApiaries} onChange={() => dispatch(toggleApiaries())} />
        )}
        {showApiariesButton && showApiaries && (
          <LayerSwitch id="layer-apiary-circles" icon="⭕" label="Rayon de 1 km" checked={showApiaryCircles} onChange={() => dispatch(toggleApiaryCircles())} sub />
        )}
        <LayerSwitch id="layer-traps" icon={OBJECT_ICONS.trap} label="Pièges" checked={showTraps} onChange={() => dispatch(toggleTraps())} />
        {showTraps && (
          <LayerSwitch id="layer-inactive-traps" icon="📦" label="Pièges remisés" checked={showInactiveTraps} onChange={() => dispatch(toggleInactiveTraps())} sub />
        )}
        {showTraps && auth.isAuthenticated && (
          <LayerSwitch id="layer-my-traps" icon="👤" label="Mes pièges seulement" checked={onlyMyTraps} onChange={() => dispatch(toggleOnlyMyTraps())} sub />
        )}
        {isAdmin && (
          <LayerSwitch
            id="layer-archives"
            icon="🗄️"
            label="Afficher les archives"
            checked={showArchivedHornets || showArchivedNests}
            onChange={() => {
              dispatch(toggleShowArchivedHornets());
              dispatch(toggleShowArchivedNests());
            }}
          />
        )}

        {!auth.isAuthenticated && (
          <p className="text-muted small mt-2 mb-0">Connectez-vous pour voir plus de couches.</p>
        )}

        {showHornets && (
          <div className="border-top mt-3 pt-3">
            <HornetColorFilterPanel />
          </div>
        )}

        {isAdmin && (
          <div className="border-top mt-3 pt-3">
            <BulkArchivePanel />
          </div>
        )}
      </BottomSheet>
    </>
  );
}
