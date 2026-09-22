import { Dropdown } from 'react-bootstrap';
import type { TrapType } from '../../store/store';

interface TrapTypeSelectProps {
  trapTypes: TrapType[];
  /** Slug of the selected type, empty while nothing is chosen */
  value: string;
  onChange: (slug: string) => void;
}

/** Thumbnail of a trap type, or a placeholder so every row lines up. */
function TypeThumbnail({ type }: { type: TrapType }) {
  const style = { height: 32, width: 32, borderRadius: 4, flexShrink: 0 };
  if (type.photo_thumbnail_url) {
    return <img src={type.photo_thumbnail_url} alt="" style={{ ...style, objectFit: 'cover' as const }} />;
  }
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center bg-body-secondary"
      style={style}
      aria-hidden="true"
    >
      🪤
    </span>
  );
}

/**
 * Trap type picker. A native `select` cannot carry an image, and the models
 * are recognised by their look far more than by their name, so this is a
 * dropdown of thumbnail + name rather than a `Form.Select`.
 */
export default function TrapTypeSelect({ trapTypes, value, onChange }: TrapTypeSelectProps) {
  const selected = trapTypes.find((type) => type.slug === value);

  return (
    <Dropdown onSelect={(slug) => slug && onChange(slug)}>
      <Dropdown.Toggle
        variant="outline-secondary"
        className="w-100 d-flex align-items-center justify-content-between text-start"
      >
        {selected
          ? (
            <span className="d-flex align-items-center gap-2 overflow-hidden">
              <TypeThumbnail type={selected} />
              <span className="text-truncate">{selected.name}</span>
            </span>
          )
          : <span className="text-muted">Choisissez un type…</span>}
      </Dropdown.Toggle>

      <Dropdown.Menu className="w-100" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {trapTypes.map((type) => (
          <Dropdown.Item
            key={type.slug}
            eventKey={type.slug}
            active={type.slug === value}
            className="d-flex align-items-center gap-2"
          >
            <TypeThumbnail type={type} />
            <span className="text-truncate">{type.name}</span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
