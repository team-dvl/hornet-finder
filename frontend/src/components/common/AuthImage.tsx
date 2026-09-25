import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import api from '../../utils/api';

type AuthImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** Media URL served by `/api/media/`, e.g. an apiary photo */
  src: string;
};

/**
 * Image of a private media file.
 *
 * The media view checks the requester's rights from the `Authorization`
 * header, which a plain `<img>` never sends: the file is fetched with the
 * token and shown from a `blob:` URL instead.
 */
export default function AuthImage({ src, alt = '', style, ...props }: AuthImageProps) {
  const [objectUrl, setObjectUrl] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    api.get(src, { baseURL: '', responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        created = URL.createObjectURL(response.data as Blob);
        setObjectUrl({ src, url: created });
      })
      .catch(() => {
        if (!cancelled) setObjectUrl({ src, url: null });
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  const current = objectUrl?.src === src ? objectUrl : null;
  if (!current) {
    return (
      <span className="d-inline-flex align-items-center justify-content-center bg-body-secondary" style={style}>
        <Spinner animation="border" size="sm" />
      </span>
    );
  }
  if (!current.url) {
    return (
      <span className="d-inline-flex align-items-center justify-content-center bg-body-secondary text-muted" style={style} title="Photo indisponible">
        <i className="bi bi-image" aria-hidden="true" />
      </span>
    );
  }
  return <img src={current.url} alt={alt} style={style} {...props} />;
}
