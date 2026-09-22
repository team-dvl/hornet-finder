import { useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { resizeImage } from '../../utils/imageResize';

interface PhotoInputProps {
  label?: string;
  multiple?: boolean;
  /** Called with the downscaled files, ready to upload */
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Photo picker for the traps module: opens the camera on a phone, downscales
 * the pictures before they reach the network and shows what will be sent.
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
      <Form.Label>{label}</Form.Label>
      <Form.Control
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        onChange={handleFiles}
        disabled={disabled || working}
      />
      {working && <Form.Text muted>Préparation de l'image…</Form.Text>}
      {previews.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
          {previews.map((preview) => (
            <img
              key={preview.url}
              src={preview.url}
              alt={preview.name}
              style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
          <Button variant="link" size="sm" className="text-danger" onClick={handleClear}>
            Retirer
          </Button>
        </div>
      )}
    </Form.Group>
  );
}
