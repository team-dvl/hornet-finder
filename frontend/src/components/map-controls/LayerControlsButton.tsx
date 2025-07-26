import { useState, useRef } from 'react';
import { Button, Overlay, ListGroup, Popover } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useAuth } from 'react-oidc-context';
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
  const showHornets = useAppSelector(selectShowHornets);
  const showReturnZones = useAppSelector(selectShowReturnZones);
  const showApiaries = useAppSelector(selectShowApiaries);
  const showApiaryCircles = useAppSelector(selectShowApiaryCircles);
  const showNests = useAppSelector(selectShowNests);

  const handleTogglePopover = () => {
    setShowPopover(!showPopover);
  };

  const handleHornetsToggle = () => {
    // Comportement identique à handleApiariesToggle
    dispatch(toggleHornets());
  };

  const handleReturnZonesToggle = () => {
    // Comportement identique à handleApiaryCirclesToggle
    dispatch(toggleReturnZones());
  };

  const handleApiariesToggle = () => {
    dispatch(toggleApiaries());
  };

  const handleApiaryCirclesToggle = () => {
    dispatch(toggleApiaryCircles());
  };

  const handleNestsToggle = () => {
    dispatch(toggleNests());
  };

  const handleClose = () => {
    setShowPopover(false);
  };

  // Déterminer l'état du bouton principal (actif si au moins une couche est visible)
  const hasActiveLayers = showHornets || showApiaries || showApiaryCircles || showNests;

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

            {/* Zones de retour - visible uniquement si les frelons sont activés */}
            {showHornets && (
              <ListGroup.Item 
                className="d-flex justify-content-between align-items-center px-0 py-2 ps-3"
                style={{ border: 'none', backgroundColor: '#f8f9fa' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">🔴</span>
                  <span className="text-muted small">Zones de retour</span>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={showReturnZones}
                    onChange={handleReturnZonesToggle}
                  />
                </div>
              </ListGroup.Item>
            )}

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

            {/* Cercles autour des ruchers - visible uniquement si les ruchers sont activés */}
            {showApiariesButton && showApiaries && (
              <ListGroup.Item 
                className="d-flex justify-content-between align-items-center px-0 py-2 ps-3"
                style={{ border: 'none', backgroundColor: '#f8f9fa' }}
              >
                <div className="d-flex align-items-center">
                  <span className="me-2">⭕</span>
                  <span className="text-muted small">Rayon 1km</span>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={showApiaryCircles}
                    onChange={handleApiaryCirclesToggle}
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
