import { useEffect, useState } from 'react';
import { Alert, ListGroup, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { BottomSheet } from '../ui';
import { AuditError, fetchAuditExportLink, type AuditExportLink, type AuditFilters } from '../../utils/auditApi';

interface AuditExportSheetProps {
  onHide: () => void;
  filters: AuditFilters;
}

/**
 * Export of the events shown, as CSV. The link is asked for when the sheet
 * opens and lasts 15 minutes; it opens without a session, so the file also
 * downloads from an app installed on the home screen.
 */
export default function AuditExportSheet({ onHide, filters }: AuditExportSheetProps) {
  const [link, setLink] = useState<AuditExportLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let current = true;
    fetchAuditExportLink(JSON.parse(filtersKey) as AuditFilters)
      .then((answer) => { if (current) setLink(answer); })
      .catch((e: unknown) => { if (current) setError(e instanceof AuditError ? e.message : String(e)); });
    return () => { current = false; };
  }, [filtersKey]);

  return (
    <BottomSheet show onHide={onHide} title="Exporter">
      {error && <Alert variant="danger" className="small py-2">{error}</Alert>}
      <ListGroup variant="flush">
        <ListGroup.Item
          action
          as="a"
          href={link?.url}
          download={link?.filename}
          target="_blank"
          rel="noopener"
          disabled={!link}
          aria-busy={!link}
          onClick={onHide}
          className="d-flex align-items-center gap-3 px-1 py-2"
        >
          <i className="bi bi-filetype-csv fs-5 flex-shrink-0" aria-hidden="true" />
          <span className="flex-grow-1">Tableur (CSV)</span>
          {!link && !error && <Spinner animation="border" size="sm" />}
        </ListGroup.Item>
      </ListGroup>
      <div className="small text-muted d-flex align-items-center mt-2">
        Événements filtrés, 50 000 au plus
        <HelpTip id="audit-export-help" title="Export du journal" doc="admin#audit">
          Le fichier reprend les filtres en cours, avec le détail de chaque événement. L&apos;export est
          lui-même enregistré dans le journal.
        </HelpTip>
      </div>
    </BottomSheet>
  );
}
