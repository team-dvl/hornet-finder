import { useRef, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { resizeImage } from '../../utils/imageResize';

interface PhotoInputProps {
  label?: string;
  multiple?: boolean;
  /** Called with the downscaled files, ready to upload */
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Photo picker for the traps module: a camera button (the camera opens on a
 * phone), the pictures downscaled before they reach the network, and
 * thumbnails of what will be sent.
 */
export default function PhotoInput({ label = 'Photo', multiple = false, onChange, disabled }: PhotoInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [working, setWorking] = useState(false);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    setWorking(true);
    const resized = await Promise.all(selected.map((file) => resizeImage(file)));
    setWorking(false);

    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviews(resized.map((file) => ({ url: URL.createObjectURL(file), name: file.name })));
    onChange(resized);
  };

  const handleClear = () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = '';
    onChange([]);
  };

  return (
    <Form.Group className="mb-3">
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <Button
          variant="outline-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || working}
        >
          {working
            ? <Spinner animation="border" size="sm" className="me-2" />
            : <i className="bi bi-camera me-2" aria-hidden="true" />}
          {label}
        </Button>
        {previews.map((preview) => (
          <img
            key={preview.url}
            src={preview.url}
            alt={preview.name}
            style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 4 }}
          />
        ))}
        {previews.length > 0 && (
          <Button
            variant="link"
            className="text-danger icon-button"
            onClick={handleClear}
            aria-label="Retirer les photos"
            title="Retirer les photos"
          >
            <i className="bi bi-x-circle" aria-hidden="true" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="d-none"
        onChange={handleFiles}
      />
    </Form.Group>
  );
}
