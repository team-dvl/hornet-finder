import { useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { addNestPhotos, type NestPhoto } from '../../store/store';
import { AuthImage } from '../common';
import { resizeImage } from '../../utils/imageResize';

interface NestPhotosProps {
  nestId: number;
  photos: NestPhoto[];
  /** Adding photos (admins, coordinators of the nest hunters) */
  canAdd: boolean;
  /** Opens a photo full size, where it can also be removed */
  onOpen: (photo: NestPhoto) => void;
  onError: (message: string | null) => void;
}

/** Thumbnails of a nest's photos, with a tile to add some (camera on a phone). */
export default function NestPhotos({ nestId, photos, canAdd, onOpen, onError }: NestPhotosProps) {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  if (photos.length === 0 && !canAdd) return null;

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;
    setUploading(true);
    onError(null);
    try {
      const resized = await Promise.all(selected.map((file) => resizeImage(file)));
      await dispatch(addNestPhotos({ id: nestId, photos: resized })).unwrap();
    } catch (uploadError) {
      onError(typeof uploadError === 'string' ? uploadError : "Les photos n'ont pas pu être ajoutées");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="nest-photo-grid mb-2">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className="nest-photo-tile"
          onClick={() => onOpen(photo)}
          aria-label={`Photo ${index + 1} du nid`}
        >
          <AuthImage src={photo.thumbnail_url ?? photo.url ?? ''} alt="" />
        </button>
      ))}
      {canAdd && (
        <>
          <button
            type="button"
            className="nest-photo-tile nest-photo-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Ajouter des photos"
            title="Ajouter des photos"
          >
            {uploading
              ? <Spinner animation="border" size="sm" />
              : <i className="bi bi-camera" aria-hidden="true" />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="d-none"
            onChange={handleFiles}
          />
        </>
      )}
    </div>
  );
}
