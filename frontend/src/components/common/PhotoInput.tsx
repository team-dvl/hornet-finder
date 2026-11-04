import { useEffect, useRef, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { usePhotoPicker } from '../../hooks/usePhotoPicker';

/** What the server takes in one request (nests, visits) */
const DEFAULT_MAX = 10;

interface PhotoInputProps {
  label?: string;
  /** Pictures add up over several passes; one picture otherwise, replaced by the next */
  multiple?: boolean;
  /** At most this many pictures (multiple only) */
  max?: number;
  /** Called with every picture chosen so far, downscaled, ready to upload */
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

interface Chosen {
  file: File;
  url: string;
}

/**
 * Photo picker of the forms: a camera button, the thumbnails of what will be
 * sent, each with its own remove button. With `multiple`, each pass adds to
 * the pictures already chosen, up to `max`.
 */
export default function PhotoInput({ label = 'Photo', multiple = false, max = DEFAULT_MAX, onChange, disabled }: PhotoInputProps) {
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const limit = multiple ? max : 1;

  // The object URLs of the thumbnails are freed when the picker goes away
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const update = (next: Chosen[]) => {
    const kept = new Set(next.map((item) => item.url));
    urls.current.filter((url) => !kept.has(url)).forEach((url) => URL.revokeObjectURL(url));
    urls.current = [...kept];
    setChosen(next);
    onChange(next.map((item) => item.file));
  };

  const { open, input, preparing } = usePhotoPicker({
    multiple,
    onPicked: (files) => {
      const added = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
      update(multiple ? [...chosen, ...added].slice(0, limit) : added.slice(0, 1));
    },
  });

  const full = multiple && chosen.length >= limit;

  return (
    <Form.Group className="mb-3">
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <Button variant="outline-secondary" onClick={open} disabled={disabled || preparing || full}>
          {preparing
            ? <Spinner animation="border" size="sm" className="me-2" />
            : <i className="bi bi-camera me-2" aria-hidden="true" />}
          {label}
        </Button>
        {chosen.map((item, index) => (
          <span key={item.url} className="photo-input-thumb">
            <img src={item.url} alt={`Photo ${index + 1}`} />
            <button
              type="button"
              className="photo-input-remove"
              onClick={() => update(chosen.filter((other) => other !== item))}
              disabled={disabled}
              aria-label={`Retirer la photo ${index + 1}`}
              title="Retirer la photo"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      {full && <Form.Text className="text-muted">{limit} photos au plus par envoi.</Form.Text>}
      {input}
    </Form.Group>
  );
}
