import { useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import type { Species } from '../../store/store';
import { resizeImage } from '../../utils/imageResize';

/** Square picture of a species, or a placeholder when it has none. */
export function SpeciesImage({ src, name, credit }: { src: string | null; name: string; credit?: string }) {
  const style: React.CSSProperties = { width: '100%', aspectRatio: '1 / 1', display: 'block' };
  if (src) {
    return <img src={src} alt={name} title={credit || name} style={{ ...style, objectFit: 'cover' }} />;
  }
  return (
    <span
      className="d-flex align-items-center justify-content-center bg-body-secondary"
      style={{ ...style, fontSize: '2.2rem' }}
      aria-hidden="true"
    >
      🪲
    </span>
  );
}

interface SpeciesCardProps {
  species: Species | undefined;
  /** Shown while the referential is still loading */
  fallbackName: string;
  quantity: number;
  /** Photo of this catch, which replaces the species picture */
  photo: File | null;
  onQuantityChange: (quantity: number) => void;
  onPhotoChange: (photo: File | null) => void;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * One species found in the trap: its picture, a count badge and the buttons
 * to adjust it. Tapping the picture adds one, which is how a catch is counted
 * in the field; the badge opens a number field for large counts.
 */
export default function SpeciesCard({
  species, fallbackName, quantity, photo, onQuantityChange, onPhotoChange, onRemove, disabled,
}: SpeciesCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Preview of the photo, created and revoked by the handlers like PhotoInput does
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const name = species?.name ?? fallbackName;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreparing(true);
    try {
      const resized = await resizeImage(file);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(URL.createObjectURL(resized));
      onPhotoChange(resized);
    } finally {
      setPreparing(false);
      event.target.value = '';
    }
  };

  const clearPhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    onPhotoChange(null);
  };

  return (
    <div className={`card overflow-hidden ${quantity === 0 ? 'opacity-50' : ''}`}>
      <div className="position-relative">
        <button
          type="button"
          className="border-0 p-0 bg-transparent w-100 d-block"
          onClick={() => onQuantityChange(quantity + 1)}
          disabled={disabled}
          aria-label={`${name} : +1`}
        >
          <SpeciesImage
            src={photoUrl ?? species?.photo_thumbnail_url ?? null}
            name={name}
            credit={photoUrl ? undefined : species?.photo_credit}
          />
        </button>

        {editing ? (
          <Form.Control
            type="number"
            size="sm"
            min={0}
            autoFocus
            value={quantity}
            onChange={(event) => onQuantityChange(Math.max(0, Number(event.target.value) || 0))}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              // Enter must not submit the whole form
              if (event.key === 'Enter') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            className="position-absolute top-0 end-0 m-1 text-end"
            style={{ width: 72 }}
          />
        ) : (
          <button
            type="button"
            className="badge rounded-pill text-bg-danger border-0 position-absolute top-0 end-0 m-1 fs-6"
            onClick={() => setEditing(true)}
            disabled={disabled}
            title="Saisir le nombre"
          >
            {quantity}
          </button>
        )}

        <button
          type="button"
          className="btn btn-sm btn-light position-absolute top-0 start-0 m-1 py-0 px-1 lh-1"
          onClick={onRemove}
          disabled={disabled}
          title="Retirer cette espèce"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <div className="px-1 pt-1 small text-center text-truncate" title={species?.scientific_name || name}>
        {name}
      </div>

      <div className="d-flex">
        <Button
          variant="link"
          size="sm"
          className="flex-fill text-decoration-none"
          onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
          disabled={disabled || quantity === 0}
          aria-label="Retirer un"
        >
          <i className="bi bi-dash-lg" aria-hidden="true" />
        </Button>
        <Button
          variant="link"
          size="sm"
          className={`flex-fill text-decoration-none ${photo ? 'text-success' : 'text-secondary'}`}
          onClick={() => (photo ? clearPhoto() : inputRef.current?.click())}
          disabled={disabled || preparing}
          title={photo ? 'Retirer la photo' : 'Photographier cette capture'}
        >
          <i className={`bi ${photo ? 'bi-camera-fill' : 'bi-camera'}`} aria-hidden="true" />
        </Button>
        <Button
          variant="link"
          size="sm"
          className="flex-fill text-decoration-none"
          onClick={() => onQuantityChange(quantity + 1)}
          disabled={disabled}
          aria-label="Ajouter un"
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="d-none"
        onChange={handleFile}
      />
    </div>
  );
}
