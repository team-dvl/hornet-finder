import { useEffect, useState } from 'react';
import { Alert, ListGroup, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { formatTime } from '../../utils/format';
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
}

const FORMATS: { format: ExportFormat; label: string; icon: string }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: 'file-earmark-spreadsheet' },
  { format: 'pdf', label: 'PDF, tableau et graphique', icon: 'file-earmark-pdf' },
  { format: 'csv', label: 'CSV', icon: 'filetype-csv' },
];

/**
 * Files of the statistic shown. The signed links are prepared when the sheet
 * opens, so the tap is a plain link: the only thing an iOS home-screen app
 * follows (it ignores blob downloads). A link lasts 15 minutes.
 */
export default function StatExportSheet({ onHide, statId, params, exports }: StatExportSheetProps) {
  const formats = FORMATS.filter(({ format }) => exports.includes(format));
  const formatsKey = formats.map(({ format }) => format).join(',');
  const [links, setLinks] = useState<Partial<Record<ExportFormat, ExportLink>>>({});
  const [error, setError] = useState<string | null>(null);
  const { userEmail } = useUserPermissions();
  const [mailing, setMailing] = useState(false);
  const [emailed, setEmailed] = useState<EmailedLink | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    formatsKey.split(',').filter(Boolean).forEach((format) => {
      fetchExportLink(statId, format as ExportFormat, JSON.parse(paramsKey))
        .then((link) => { if (!cancelled) setLinks((current) => ({ ...current, [format]: link })); })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof StatsError ? e.message : String(e)); });
    });
    return () => { cancelled = true; };
  }, [statId, paramsKey, formatsKey]);

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
        {formats.map(({ format, label, icon }) => {
          const link = links[format];
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
        {userEmail && !emailed && (
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
