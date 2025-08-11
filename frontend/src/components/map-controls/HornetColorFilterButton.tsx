import { useState, useRef } from 'react';
import { Button, Overlay, Popover, Form, Row, Col } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { ColorSelector } from '../common';
import { setColorFilters, clearColorFilters, selectColorFilters } from '../../store/slices/hornetsSlice';
import { getColorHex } from '../../utils/colors';

export default function HornetColorFilterButton() {
  const [showPopover, setShowPopover] = useState(false);
  const target = useRef(null);
  
  const dispatch = useAppDispatch();
  const colorFilters = useAppSelector(selectColorFilters);

  const handleTogglePopover = () => {
    setShowPopover(!showPopover);
  };

  const handleColor1Change = (color: string) => {
    dispatch(setColorFilters({
      color1: color,
      color2: colorFilters.color2
    }));
  };

  const handleColor2Change = (color: string) => {
    dispatch(setColorFilters({
      color1: colorFilters.color1,
      color2: color
    }));
  };

  const handleReset = () => {
    dispatch(clearColorFilters());
  };

  const handleClose = () => {
    setShowPopover(false);
  };

  // Déterminer si des filtres sont actifs
  const hasActiveFilters = colorFilters.color1 || colorFilters.color2;

  // Composant pour afficher un petit rectangle coloré
  const ColorIndicator = ({ color }: { color: string }) => {
    if (!color) return null;
    
    const colorHex = getColorHex(color);
    return (
      <div
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: colorHex,
          border: '1px solid #000',
          borderRadius: '2px',
          flexShrink: 0,
        }}
        title={color}
      />
    );
  };

  // Composant pour afficher les couleurs avec gestion responsive
  const ColorIndicators = () => {
    if (!hasActiveFilters) return null;
    
    const colors = [colorFilters.color1, colorFilters.color2].filter(Boolean);
    if (colors.length === 0) return null;
    
    return (
      <div className="color-indicators">
        {colors.map((color, index) => (
          <ColorIndicator key={index} color={color} />
        ))}
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          .hornet-filter-button:hover {
            background-color: #8B4513 !important; /* brun au survol */
            color: white !important;
          }
          
          .color-indicators {
            display: flex;
            flex-direction: row;
            gap: 2px;
            align-items: center;
          }
          
          @media (max-width: 576px) {
            .color-indicators {
              flex-direction: column !important;
              gap: 1px !important;
            }
          }
        `}
      </style>
      <Button
        ref={target}
        onClick={handleTogglePopover}
        variant={hasActiveFilters ? "warning" : "outline-secondary"}
        size="sm"
        className="map-control-button hornet-filter-button"
        title="Filtrer les frelons par couleur"
        style={{ 
          opacity: 0.7, 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          backgroundColor: hasActiveFilters ? undefined : '#f5f5dc' // beige quand pas de filtre actif
        }}
      >
        <span className="map-control-button-icon">🎨</span>
        <span className="map-control-button-text">Filtres</span>
        <ColorIndicators />
      </Button>

      <Overlay 
        target={target.current} 
        show={showPopover} 
        placement="bottom"
        rootClose
        onHide={handleClose}
      >
        {(props) => (
          <Popover {...props} id="color-filter-popover">
            <Popover.Header>
              <strong>Filtrer par couleur de marquage</strong>
            </Popover.Header>
            <Popover.Body className="p-3">
              <Form>
                <Row className="g-2">
                  <Col xs={12}>
                    <ColorSelector
                      value={colorFilters.color1}
                      onChange={handleColor1Change}
                      label="Couleur 1"
                      size="sm"
                    />
                  </Col>
                  <Col xs={12}>
                    <ColorSelector
                      value={colorFilters.color2}
                      onChange={handleColor2Change}
                      label="Couleur 2"
                      size="sm"
                    />
                  </Col>
                </Row>

                <div className="mt-3 d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {hasActiveFilters ? (
                      <div className="d-flex align-items-center gap-1">
                        <span>Filtres actifs :</span>
                        {colorFilters.color1 && <ColorIndicator color={colorFilters.color1} />}
                        {colorFilters.color2 && <ColorIndicator color={colorFilters.color2} />}
                      </div>
                    ) : (
                      'Aucun filtre actif'
                    )}
                  </small>
                  
                  <div className="d-flex gap-2">
                    {hasActiveFilters && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleReset}
                      >
                        Reset
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleClose}
                    >
                      OK
                    </Button>
                  </div>
                </div>

                <div className="mt-2">
                  <small className="text-muted">
                    <strong>Info :</strong> Seuls les frelons ayant au moins une des couleurs sélectionnées seront affichés.
                    Les frelons sans marquage de couleur seront masqués si des filtres sont actifs.
                  </small>
                </div>
              </Form>
            </Popover.Body>
          </Popover>
        )}
      </Overlay>
    </>
  );
}
