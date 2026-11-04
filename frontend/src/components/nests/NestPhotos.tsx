import { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { addNestPhotos, type Nest, type NestPhoto } from '../../store/store';
import { AuthImage } from '../common';
import { usePhotoPicker } from '../../hooks/usePhotoPicker';

interface NestPhotosProps {
  nestId: number;
  photos: NestPhoto[];
  /** Adding photos (admins, coordinators of the nest hunters) */
  canAdd: boolean;
  /** Opens a photo full size, where it can also be removed */
  onOpen: (photo: NestPhoto) => void;
  onError: (message: string | null) => void;
  /** The nest as it is once the photos are added */
  onChanged?: (nest: Nest) => void;
}

/** Thumbnails of a nest's photos, with a tile to add some (camera on a phone). */
export default function NestPhotos({ nestId, photos, canAdd, onOpen, onError, onChanged }: NestPhotosProps) {
  const dispatch = useAppDispatch();
  const [uploading, setUploading] = useState(false);

  const upload = async (resized: File[]) => {
    setUploading(true);
    onError(null);
    try {
      const nest = await dispatch(addNestPhotos({ id: nestId, photos: resized })).unwrap();
      onChanged?.(nest);
    } catch (uploadError) {
      onError(typeof uploadError === 'string' ? uploadError : "Les photos n'ont pas pu être ajoutées");
    } finally {
      setUploading(false);
    }
  };
  const picker = usePhotoPicker({ multiple: true, onPicked: upload });

  if (photos.length === 0 && !canAdd) return null;


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
            onClick={picker.open}
            disabled={uploading || picker.preparing}
            aria-label="Ajouter des photos"
            title="Ajouter des photos"
          >
            {uploading || picker.preparing
              ? <Spinner animation="border" size="sm" />
              : <i className="bi bi-camera" aria-hidden="true" />}
          </button>
          {picker.input}
        </>
      )}
    </div>
  );
}
