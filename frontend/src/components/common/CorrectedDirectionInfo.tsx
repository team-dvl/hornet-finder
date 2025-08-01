import { OverlayTrigger, Popover } from 'react-bootstrap';

interface CorrectedDirectionInfoProps {
  correctedDirection: number;
  declination: number;
  popoverId?: string;
}

/**
 * Affiche une direction corrigée (en degrés) avec un popover détaillant la direction magnétique et la déclinaison.
 * Read-only, pure display.
 */
export default function CorrectedDirectionInfo({ correctedDirection, declination, popoverId }: CorrectedDirectionInfoProps) {
  /**
   * Convertit un angle en degrés (0-360) en direction cardinale (N, NNE, NE, ...).
   */
  function getCardinalDirection(degrees: number): string {
    const directions = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSO', 'SO', 'OSO',
      'O', 'ONO', 'NO', 'NNO',
    ];
    const index = Math.round(((degrees % 360) / 22.5)) % 16;
    return directions[index];
  }

  const cardinal = getCardinalDirection(correctedDirection);

  return (
    <span>
      {correctedDirection.toFixed(0)}°
      <span className="text-muted" style={{ marginLeft: 4 }}>
        ({cardinal})
      </span>
      &nbsp;
      <OverlayTrigger
        trigger={["hover", "focus"]}
        placement="top"
        overlay={
          <Popover id={popoverId || 'popover-corrected-direction'}>
            <Popover.Header as="h3">Détails direction</Popover.Header>
            <Popover.Body>
              <div className="d-flex justify-content-between">
                <span>Relevé boussole:</span>
                <span className="text-end" style={{ minWidth: 60 }}>{(correctedDirection - declination).toFixed(1)}°</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Déclinaison:</span>
                <span className="text-end" style={{ minWidth: 60 }}>{declination.toFixed(1)}°</span>
              </div>
            </Popover.Body>
          </Popover>
        }
      >
        <i
          className="bi bi-info-circle"
          style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
          tabIndex={0}
        />
      </OverlayTrigger>
    </span>
  );
}
