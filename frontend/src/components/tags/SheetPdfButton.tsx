import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from 'react-bootstrap';
import { TagError, type SheetLink } from '../../utils/tagsApi';
import { detectPWAAuthState } from '../../utils/pwaAuth';

interface SheetPdfButtonProps {
  /** Asks the server for the signed link of the sheet */
  request: () => Promise<SheetLink>;
  /** Changes whenever the tags to print change, to prepare a new link */
  requestKey: string;
  onError: (message: string) => void;
  variant?: ButtonProps['variant'];
  children: ReactNode;
}

const FILE_NAME = 'qr-codes.pdf';

/**
 * True in an installed app able to share files. There, a PDF opened with
 * target="_blank" is handed to a chrome-less web view: it shows the document
 * but offers no print, no share and no way back, so the sheet is a dead end.
 * The native share sheet has both "Print" and "Save to Files", and it never
 * leaves the page. In a normal browser tab the PDF viewer already prints, so
 * the plain link stays.
 */
function usesShareSheet(): boolean {
  if (!detectPWAAuthState().isPWA || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], FILE_NAME, { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/** The server's own message for a refused sheet (expired link, revoked tags). */
async function sheetError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  return body.trim() || `Le PDF n'a pas pu être récupéré (erreur ${response.status}).`;
}

/**
 * Button giving the A4 PDF of a sheet to print or save. The signed link is
 * prepared beforehand and renewed before it expires, so the tap itself is
 * either a plain link or a single fetch: the only things an iOS home-screen
 * app follows (it ignores window.print and blob downloads).
 */
export default function SheetPdfButton({ request, requestKey, onError, variant = 'outline-primary', children }: SheetPdfButtonProps) {
  /** The prepared link, with the key it was made for: a stale one is never shown */
  const [link, setLink] = useState<{ key: string; url: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const url = link?.key === requestKey ? link.url : null;
  // Decided once: the display mode does not change while the app runs
  const [shareSheet] = useState(usesShareSheet);
  // Latest callbacks, without making them effect dependencies
  const requestRef = useRef(request);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    requestRef.current = request;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const prepare = () => {
      requestRef.current()
        .then((sheet) => {
          if (cancelled) return;
          setLink({ key: requestKey, url: sheet.url });
          // Renew at 80 % of the lifetime, so a tap never hits an expired link
          timer = window.setTimeout(prepare, sheet.expires_in * 800);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          onErrorRef.current(e instanceof TagError ? e.message : String(e));
        });
    };
    // Debounced: a selection often changes several times in a row
    timer = window.setTimeout(prepare, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestKey]);

  const share = async () => {
    if (!url || sharing) return;
    setSharing(true);
    try {
      // The link is already prepared, so this stays within the user gesture
      const response = await fetch(url);
      if (!response.ok) throw new Error(await sheetError(response));
      const file = new File([await response.blob()], FILE_NAME, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: 'QR Codes Velutina' });
    } catch (e) {
      // The share sheet was dismissed: an ordinary outcome, not an error
      if (e instanceof DOMException && e.name === 'AbortError') return;
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const busy = !url || sharing;
  const icon = <i className="bi bi-printer me-1" aria-hidden="true" />;
  const label = url ? (sharing ? 'Préparation du PDF…' : children) : 'Préparation…';

  if (shareSheet) {
    return (
      <Button variant={variant} size="sm" disabled={busy} aria-busy={busy} onClick={() => void share()}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <Button
      as="a"
      href={url ?? undefined}
      target="_blank"
      rel="noopener"
      variant={variant}
      size="sm"
      disabled={busy}
      aria-busy={busy}
    >
      {icon}
      {label}
    </Button>
  );
}
