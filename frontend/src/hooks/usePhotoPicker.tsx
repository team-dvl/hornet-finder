import { useRef, useState } from 'react';
import { resizeImage } from '../utils/imageResize';

interface PhotoPickerOptions {
  /** Several pictures per pass (the library); one otherwise */
  multiple?: boolean;
  /** Receives the pictures of one pass, downscaled and ready to upload */
  onPicked: (files: File[]) => void | Promise<void>;
}

/**
 * The one way the app takes pictures: a hidden file input (a phone offers the
 * camera or the photo library), the pictures downscaled before they reach the
 * network, and the input emptied after each pass so the same picture can be
 * chosen again. `PhotoInput` builds on it; a component with its own trigger
 * (a tile, an icon) calls `open` and renders `input`.
 */
export function usePhotoPicker({ multiple = false, onPicked }: PhotoPickerOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preparing, setPreparing] = useState(false);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;
    setPreparing(true);
    try {
      await onPicked(await Promise.all(selected.map((file) => resizeImage(file))));
    } finally {
      setPreparing(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple={multiple}
      className="d-none"
      onChange={(event) => void handleChange(event)}
    />
  );

  return { open: () => inputRef.current?.click(), input, preparing };
}
