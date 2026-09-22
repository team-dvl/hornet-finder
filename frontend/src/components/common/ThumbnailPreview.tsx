import { OverlayTrigger, Popover } from 'react-bootstrap';

interface ThumbnailPreviewProps {
  /** Small image shown in place */
  thumbnailUrl: string;
  /** Full-size image shown while hovering; falls back to the thumbnail */
  fullUrl?: string | null;
  alt?: string;
  /** Side of the thumbnail, in pixels */
  size?: number;
}

/**
 * Thumbnail that shows the full image on hover, for the referential tables.
 * The trigger is focusable so the preview is reachable from the keyboard and
 * on a touch screen, where there is no hover.
 */
export default function ThumbnailPreview({
  thumbnailUrl, fullUrl, alt = '', size = 40,
}: ThumbnailPreviewProps) {
  const preview = (
    <Popover className="shadow">
      <Popover.Body className="p-1">
        <img
          src={fullUrl ?? thumbnailUrl}
          alt={alt}
          style={{ maxWidth: 320, maxHeight: 320, display: 'block' }}
        />
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger placement="right" overlay={preview} trigger={['hover', 'focus']}>
      <img
        src={thumbnailUrl}
        alt={alt}
        tabIndex={0}
        style={{ height: size, width: size, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in' }}
      />
    </OverlayTrigger>
  );
}
