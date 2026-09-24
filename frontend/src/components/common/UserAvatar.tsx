import { useState } from 'react';

interface UserAvatarProps {
  /** Photo URL, or null to show the placeholder */
  url: string | null;
  /** Diameter in pixels */
  size?: number;
  className?: string;
}

/** Round profile photo, or a person icon when there is none (or it fails to load). */
export default function UserAvatar({ url, size = 32, className = '' }: UserAvatarProps) {
  // A broken URL (deleted file, expired social photo) falls back to the icon
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Never shrunk by a narrow flex parent (phone), which would turn the circle into an oval
  const fixedSize = { width: size, height: size, minWidth: size, flexShrink: 0 };

  if (!url || failedUrl === url) {
    return (
      <i
        className={`bi bi-person-circle text-secondary ${className}`}
        style={{ ...fixedSize, fontSize: size, lineHeight: 1, display: 'inline-block' }}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`rounded-circle ${className}`}
      style={{ ...fixedSize, objectFit: 'cover' }}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  );
}
