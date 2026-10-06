import { useEffect, useState } from 'react';
import { Alert, ListGroup, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { formatTime } from '../../utils/format';
import { isInstalledPwa } from '../../utils/pwa';
import {
  fetchExportLink, sendExportEmail, StatsError,
  type EmailedLink, type ExportFormat, type ExportLink, type StatParams,
} from '../../utils/statsApi';

interface StatExportSheetProps {
  /** Mounted only while open, so each opening prepares fresh links */
  onHide: () => void;
  statId: string;
  params: StatParams;
  /** Formats the statistic offers (from the catalogue) */
  exports: ExportFormat[];
  /** The server can email a link (from the catalogue) */
  emailLink: boolean;
}

const FORMATS: { format: ExportFormat; label: string; icon: string; type: string }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: 'file-earmark-spreadsheet', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { format: 'pdf', label: 'PDF, tableau et graphique', icon: 'file-earmark-pdf', type: 'application/pdf' },
  { format: 'csv', label: 'CSV', icon: 'filetype-csv', type: 'text/csv' },
];

/**
 * True in an installed app able to share such a file. There, a link opened
 * with target="_blank" lands in a chrome-less web view: the file shows, but
 * with no share, no print and no way back (same as the QR sheets, see
 * `SheetPdfButton`). The native share sheet has "Print", "Save to Files" and
 * the other apps. A browser tab keeps the plain link.
 */
function usesShareSheet(type: string): boolean {
  if (!isInstalledPwa() || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'export', { type })] });
  } catch {
    return false;
  }
}

/** The server's own message for a refused file (expired link, bad parameter). */
async function fileError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  return body.trim() || `Le fichier n'a pas pu être récupéré (erreur ${response.status}).`;
}

/**
 * Files of the statistic shown. The signed links are prepared when the sheet
 * opens. In a browser tab the tap is a plain link; in an installed app it
 * fetches the file and hands it to the native share sheet (print, save to
 * Files, other apps). A link lasts 15 minutes.
 */
export default function StatExportSheet({
  onHide, statId, params, exports, emailLink,
}: StatExportSheetProps) {
  const formats = FORMATS.filter(({ format }) => exports.includes(format));
  const formatsKey = formats.map(({ format }) => format).join(',');
  const [links, setLinks] = useState<Partial<Record<ExportFormat, ExportLink>>>({});
  const [error, setError] = useState<string | null>(null);
  const { userEmail } = useUserPermissions();
  const [mailing, setMailing] = useState(false);
  const [emailed, setEmailed] = useState<EmailedLink | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);
  // Decided once: the display mode does not change while the app runs
  const [shareSheet] = useState(() => new Set(FORMATS.filter((f) => usesShareSheet(f.type)).map((f) => f.format)));
  const [fetching, setFetching] = useState<ExportFormat | null>(null);
  /** A file fetched too slowly to share within the tap: a second tap shares it */
  const [ready, setReady] = useState<{ format: ExportFormat; file: File } | null>(null);

  useEffect(() => {
    let cancelled = false;
    formatsKey.split(',').filter(Boolean).forEach((format) => {
      fetchExportLink(statId, format as ExportFormat, JSON.parse(paramsKey))
        .then((link) => { if (!cancelled) setLinks((current) => ({ ...current, [format]: link })); })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof StatsError ? e.message : String(e)); });
    });
    return () => { cancelled = true; };
  }, [statId, paramsKey, formatsKey]);

  /** Native share sheet; called first thing in a tap, so it keeps the user gesture */
  const shareFile = async (format: ExportFormat, file: File) => {
    try {
      await navigator.share({ files: [file], title: file.name });
      setReady(null);
      onHide();
    } catch (e) {
      // The share sheet was dismissed: an ordinary outcome, not an error
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // The file took too long after the tap (it is computed on demand):
      // it is kept, and the next tap shares it at once
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setReady({ format, file });
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const share = async (format: ExportFormat, link: ExportLink, type: string) => {
    if (fetching) return;
    setFetching(format);
    setError(null);
    setReady(null);
    try {
      const response = await fetch(link.url);
      if (!response.ok) throw new Error(await fileError(response));
      await shareFile(format, new File([await response.blob()], link.filename, { type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(null);
    }
  };

  const sendEmail = async () => {
    setMailing(true);
    setMailError(null);
    try {
      setEmailed(await sendExportEmail(statId, params));
    } catch (e) {
      setMailError(e instanceof StatsError ? e.message : String(e));
    } finally {
      setMailing(false);
    }
  };

  return (
    <BottomSheet show onHide={onHide} title="Exporter">
      {error && <Alert variant="danger" className="small py-2">{error}</Alert>}
      <ListGroup variant="flush">
        {formats.map(({ format, label, icon, type }) => {
          const link = links[format];
          if (shareSheet.has(format)) {
            const isReady = ready?.format === format;
            return (
              <ListGroup.Item
                key={format}
                action
                as="button"
                type="button"
                disabled={!link || (fetching !== null && fetching !== format)}
                aria-busy={!link || fetching === format}
                onClick={() => {
                  if (isReady) void shareFile(format, ready.file);
                  else if (link) void share(format, link, type);
                }}
                className="d-flex align-items-center gap-3 px-1 py-2"
              >
                <i className={`bi bi-${isReady ? 'box-arrow-up' : icon} fs-5 flex-shrink-0`} aria-hidden="true" />
                <span className="flex-grow-1">{isReady ? `${label} : partager` : label}</span>
                {((!link && !error) || fetching === format) && <Spinner animation="border" size="sm" />}
              </ListGroup.Item>
            );
          }
          return (
            <ListGroup.Item
              key={format}
              action
              as="a"
              href={link?.url}
              // A PDF opens in the browser's viewer; the tables are saved
              download={format === 'pdf' ? undefined : link?.filename}
              target="_blank"
              rel="noopener"
              disabled={!link}
              aria-busy={!link}
              onClick={onHide}
              className="d-flex align-items-center gap-3 px-1 py-2"
            >
              <i className={`bi bi-${icon} fs-5 flex-shrink-0`} aria-hidden="true" />
              <span className="flex-grow-1">{label}</span>
              {!link && !error && <Spinner animation="border" size="sm" />}
            </ListGroup.Item>
          );
        })}
        {emailLink && userEmail && !emailed && (
          <ListGroup.Item
            action
            as="button"
            type="button"
            disabled={mailing}
            onClick={() => void sendEmail()}
            className="d-flex align-items-center gap-3 px-1 py-2"
          >
            <i className="bi bi-envelope fs-5 flex-shrink-0" aria-hidden="true" />
            <span className="flex-grow-1">Envoyer un lien par email</span>
            {mailing && <Spinner animation="border" size="sm" />}
          </ListGroup.Item>
        )}
      </ListGroup>
      {mailError && <Alert variant="danger" className="small py-2 mt-2 mb-0">{mailError}</Alert>}
      {emailed && (
        <Alert variant="success" className="small py-2 mt-2 mb-0 d-flex align-items-center">
          <span>
            Lien envoyé à {emailed.sent_to}, valable jusqu&apos;à {formatTime(emailed.expires_at)}.
          </span>
          <HelpTip id="stat-email-help" title="Lien par email">
            Le lien ouvre une page de téléchargement, sans connexion, pendant une heure et pour dix
            fichiers au plus. Les chiffres y sont calculés au moment du téléchargement, sur la
            période et avec les droits de la demande. Ne transférez pas cet email.
          </HelpTip>
        </Alert>
      )}
    </BottomSheet>
  );
}
