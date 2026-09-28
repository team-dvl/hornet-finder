import { useEffect, useState } from 'react';
import { Alert, ListGroup, Spinner } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import {
  fetchExportLink, StatsError, type ExportFormat, type ExportLink, type StatParams,
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
      </ListGroup>
    </BottomSheet>
  );
}
