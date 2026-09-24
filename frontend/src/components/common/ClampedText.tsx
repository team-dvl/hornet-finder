import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { helpOverlayTrigger } from '../../utils/overlayTrigger';

interface ClampedTextProps {
  id: string;
  text: string;
  /** Visible lines before the ellipsis */
  lines?: number;
}

/**
 * Text cut after a few lines with an ellipsis; the full text shows in a
 * tooltip on hover, or on tap on a phone.
 */
export default function ClampedText({ id, text, lines = 2 }: ClampedTextProps) {
  return (
    <OverlayTrigger trigger={helpOverlayTrigger()} rootClose placement="auto" overlay={<Tooltip id={id}>{text}</Tooltip>}>
      <span className="text-clamp" style={{ WebkitLineClamp: lines }} tabIndex={0}>
        {text}
      </span>
    </OverlayTrigger>
  );
}
