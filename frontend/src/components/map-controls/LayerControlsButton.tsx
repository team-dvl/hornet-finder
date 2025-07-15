import { useState, useRef } from 'react';
import { Button, Overlay, ListGroup, Popover } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useAuth } from 'react-oidc-context';
import {
  cycleDisplayMode,
  selectDisplayMode,
  toggleApiaries,
  selectShowApiaries,
  toggleNests,
  selectShowNests
} from '../../store/store';

interface LayerControlsButtonProps {
  showApiariesButton?: boolean;
  showNestsButton?: boolean;
}

export default function LayerControlsButton({ 
  showApiariesButton = false, 
  showNestsButton = false 
}: LayerControlsButtonProps) {
  const [showPopover, setShowPopover] = useState(false);
  const target = useRef(null);
  
  const dispatch = useAppDispatch();
  const auth = useAuth();
  
  // États des couches depuis Redux
  const displayMode = useAppSelector(selectDisplayMode);
  const showApiaries = useAppSelector(selectShowApiaries);
  const showNests = useAppSelector(selectShowNests);
  
  // Dérivé des états pour les frelons et zones
  const showHornets = displayMode !== 'hidden';
  const showReturnZones = displayMode === 'full';

  const handleTogglePopover = () => {
    setShowPopover(!showPopover);
  };

  const handleHornetsToggle = () => {
    // Si les frelons sont visibles, basculer vers masqué
    // Si les frelons sont masqués, basculer vers visible avec zones
    if (showHornets) {
      // Actuellement visible -> masquer
      if (displayMode === 'full') {
        // Frelons + zones -> seuls les frelons
        dispatch(cycleDisplayMode()); // full -> hornets-only
      } else {
        // Seuls les frelons -> masquer tout
        dispatch(cycleDisplayMode()); // hornets-only -> hidden
      }
    } else {
      // Actuellement masqué -> afficher avec zones
      dispatch(cycleDisplayMode()); // hidden -> full
    }
  };

  const handleReturnZonesToggle = () => {
    // Basculer entre affichage avec zones et sans zones
    if (showReturnZones) {
      // Actuellement avec zones -> sans zones (mais garder les frelons)
      dispatch(cycleDisplayMode()); // full -> hornets-only  
    } else {
      // Actuellement sans zones -> avec zones
      if (displayMode === 'hornets-only') {
        dispatch(cycleDisplayMode()); // hornets-only -> hidden
        dispatch(cycleDisplayMode()); // hidden -> full
      }
    }
  };

  const handleApiariesToggle = () => {
    dispatch(toggleApiaries());
  };

  const handleNestsToggle = () => {
    dispatch(toggleNests());
  };

  const handleClose = () => {
    setShowPopover(false);
  };

  // Déterminer l'état du bouton principal (actif si au moins une couche est visible)
  const hasActiveLayers = showHornets || showApiaries || showNests;

  return (
    <>
      <Button
        ref={target}
        onClick={handleTogglePopover}
        variant={hasActiveLayers ? "primary" : "outline-secondary"}
        size="sm"
        className="map-control-button"
        title="Gérer les couches affichées"
        style={{ opacity: 0.7, borderRadius: '12px', backgroundColor: '#287745' }}
      >
        <img 
          src="/layers-200px.png" 
          alt="layers" 
          style={{ 
            width: '1.8em', 
            height: '1.8em',
            filter: hasActiveLayers ? 'brightness(1.2) contrast(1.1)' : 'none'
          }} 
        />
        <span className="map-control-button-text ms-1">Couches</span>
      </Button>

      <Overlay 
        target={target.current} 
        show={showPopover} 
        placement="bottom"
        rootClose
        onHide={handleClose}
      >
        {(props) => (
          <Popover {...props} id="layer-controls-popover">
            <Popover.Header>
              <strong>Affichage des couches</strong>
            </Popover.Header>
            <Popover.Body className="p-2">
          
          <ListGroup variant="flush">
            {/* Couche Frelons */}
            <ListGroup.Item 
              className="d-flex justify-content-between align-items-center px-0 py-2"
              style={{ border: 'none' }}
            >
              <div className="d-flex align-items-center">
                <span className="me-2">🐝</span>
                <span>Frelons</span>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={showHornets}
                  onChange={handleHornetsToggle}
                />
              </div>
            </ListGroup.Item>

            {/* Couche Zones de retour */}
            <ListGroup.Item 
              className="d-flex justify-content-between align-items-center px-0 py-2"
              style={{ border: 'none' }}
            >
              <div className="d-flex align-items-center">
                <span className="me-2">🔴</span>
                <span>Zones de retour</span>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={showReturnZones}
                  onChange={handleReturnZonesToggle}
                  disabled={!showHornets}
                />
              </div>
            </ListGroup.Item>

            {/* Couche Nids - visible pour tous les utilisateurs authentifiés */}
            {showNestsButton && (
              <ListGroup.Item 
                className="d-flex justify-content-between align-items-center px-0 py-2"
                style={{ border: 'none' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">🏴</span>
                  <span>Nids</span>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={showNests}
                    onChange={handleNestsToggle}
                  />
                </div>
              </ListGroup.Item>
            )}

            {/* Couche Ruchers - visible selon permissions */}
            {showApiariesButton && (
              <ListGroup.Item 
                className="d-flex justify-content-between align-items-center px-0 py-2"
                style={{ border: 'none' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">🍯</span>
                  <span>Ruchers</span>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={showApiaries}
                    onChange={handleApiariesToggle}
                  />
                </div>
              </ListGroup.Item>
            )}
          </ListGroup>

          {/* Information sur les permissions */}
          {!auth.isAuthenticated && (
            <div className="text-muted small mt-2">
              <em>Connectez-vous pour accéder à plus d'options</em>
            </div>
          )}
            </Popover.Body>
          </Popover>
        )}
      </Overlay>
    </>
  );
}
