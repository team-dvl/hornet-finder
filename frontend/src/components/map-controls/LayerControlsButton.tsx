import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
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
  selectOnlyMyTraps,
  toggleOnlyMyApiaries,
  selectOnlyMyApiaries,
  selectMapAnalysis,
  setAnalysisLayer,
  setAnalysisPeriod,
  selectBasemap,
  setBasemap,
  type AnalysisPeriod,
} from '../../store/store';
import { HelpTip } from '../common';
import { analysisParams } from '../stats/statParams';
import { selectColorFilters } from '../../store/slices/hornetsSlice';
import { BottomSheet } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import HornetColorFilterPanel from './HornetColorFilterPanel';

interface LayerControlsButtonProps {
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
  /** Opens the list of the nests nearest to the user */
  onShowNearestNests?: () => void;
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

/** Map button opening the layers sheet: layers (archives included for admins), hornet colour filter. */
export default function LayerControlsButton({ 
  showApiariesButton = false, 
  showNestsButton = false,
  onShowNearestNests,
}: LayerControlsButtonProps) {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { isAdmin, canAddApiary, roles } = useUserPermissions();
  const analysis = useAppSelector(selectMapAnalysis);
  // Statistics are open to every role
  const canAnalyse = auth.isAuthenticated && roles.length > 0;
  const thisYear = new Date().getFullYear();
  const analysisLink = analysis.layer
    ? `/stats/traps-${analysis.layer}?${new URLSearchParams(analysisParams(analysis.period, analysis.year))}`
    : '';
  
  const basemap = useAppSelector(selectBasemap);
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
  const onlyMyApiaries = useAppSelector(selectOnlyMyApiaries);
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
        <LayerSwitch id="basemap-plan" icon="🗺️" label="Plan" checked={basemap === 'plan'} onChange={() => dispatch(setBasemap('plan'))} />
        <LayerSwitch id="basemap-satellite" icon="🛰️" label="Satellite" checked={basemap === 'satellite'} onChange={() => dispatch(setBasemap('satellite'))} />
        <div className="border-top my-2" />
        <LayerSwitch id="layer-hornets" icon={OBJECT_ICONS.hornet} label="Frelons" checked={showHornets} onChange={() => dispatch(toggleHornets())} />
        {showHornets && (
          <LayerSwitch id="layer-zones" icon="🔺" label="Zones de retour" checked={showReturnZones} onChange={() => dispatch(toggleReturnZones())} sub />
        )}
        {showNestsButton && (
          <LayerSwitch id="layer-nests" icon={OBJECT_ICONS.nest} label="Nids" checked={showNests} onChange={() => dispatch(toggleNests())} />
        )}
        {showNestsButton && onShowNearestNests && (
          <button
            type="button"
            className="layer-switch layer-switch-sub layer-action"
            onClick={() => {
              // One overlay at a time: the list replaces this sheet
              setOpen(false);
              onShowNearestNests();
            }}
          >
            <span className="me-2" aria-hidden="true">📏</span>
            <span className="flex-grow-1">Nids les plus proches</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        )}
        {showApiariesButton && (
          <LayerSwitch id="layer-apiaries" icon={OBJECT_ICONS.apiary} label="Ruchers" checked={showApiaries} onChange={() => dispatch(toggleApiaries())} />
        )}
        {showApiariesButton && showApiaries && (
          <LayerSwitch id="layer-apiary-circles" icon="⭕" label="Rayon de 1 km" checked={showApiaryCircles} onChange={() => dispatch(toggleApiaryCircles())} sub />
        )}
        {showApiariesButton && showApiaries && canAddApiary && (
          <LayerSwitch id="layer-my-apiaries" icon="👤" label="Mes ruchers seulement" checked={onlyMyApiaries} onChange={() => dispatch(toggleOnlyMyApiaries())} sub />
        )}
        <LayerSwitch id="layer-traps" icon={OBJECT_ICONS.trap} label="Pièges" checked={showTraps} onChange={() => dispatch(toggleTraps())} />
        {showTraps && (
          <LayerSwitch id="layer-inactive-traps" icon="📦" label="Pièges remisés" checked={showInactiveTraps} onChange={() => dispatch(toggleInactiveTraps())} sub />
        )}
        {showTraps && auth.isAuthenticated && (
          <LayerSwitch id="layer-my-traps" icon="👤" label="Mes pièges seulement" checked={onlyMyTraps} onChange={() => dispatch(toggleOnlyMyTraps())} sub />
        )}
        {canAnalyse && (
          <div className="border-top mt-2 pt-2">
            <div className="small text-muted d-flex align-items-center">
              Analyse du piégeage
              <HelpTip id="layer-analysis-help" doc="stats#coverage" title="Analyse du piégeage">
                Une grille de mailles de 250 m. La couverture montre la part de chaque maille à
                moins de 250 m d&apos;un piège en service ; la pression, les frelons asiatiques par
                piège et par semaine, lissés. Seuls les pièges que vous voyez sont comptés.
              </HelpTip>
            </div>
            <LayerSwitch
              id="layer-coverage"
              icon="🟦"
              label="Couverture"
              checked={analysis.layer === 'coverage'}
              onChange={() => dispatch(setAnalysisLayer(analysis.layer === 'coverage' ? null : 'coverage'))}
            />
            <LayerSwitch
              id="layer-pressure"
              icon="🟧"
              label="Pression"
              checked={analysis.layer === 'pressure'}
              onChange={() => dispatch(setAnalysisLayer(analysis.layer === 'pressure' ? null : 'pressure'))}
            />
            {analysis.layer && (
              <>
                <Form.Select
                  className="mt-2"
                  aria-label="Période de l'analyse"
                  value={`${analysis.period}:${analysis.year}`}
                  onChange={(event) => {
                    const [period, year] = event.target.value.split(':');
                    dispatch(setAnalysisPeriod({ period: period as AnalysisPeriod, year: Number(year) }));
                  }}
                >
                  {[thisYear, thisYear - 1].map((year) => (
                    <optgroup key={year} label={String(year)}>
                      <option value={`spring:${year}`}>Printemps {year}</option>
                      <option value={`summer:${year}`}>Été {year}</option>
                      <option value={`late:${year}`}>Été-automne-hiver {year}</option>
                      <option value={`year:${year}`}>Année {year}</option>
                    </optgroup>
                  ))}
                </Form.Select>
                <Link to={analysisLink} className="d-inline-flex align-items-center small mt-2 stat-layer-link">
                  Chiffres et export
                  <i className="bi bi-chevron-right ms-1" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
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
      </BottomSheet>
    </>
  );
}
