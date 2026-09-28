import { useEffect, useState } from 'react';
import { Container, ListGroup, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { FieldRow } from '../../components/ui';
import { formatTime } from '../../utils/format';
import { fetchExportJob, StatsError, type ExportFormat, type ExportJob as Job } from '../../utils/statsApi';

const FORMAT_LABELS: Record<ExportFormat, { label: string; icon: string }> = {
  xlsx: { label: 'Excel (.xlsx)', icon: 'file-earmark-spreadsheet' },
  pdf: { label: 'PDF, tableau et graphique', icon: 'file-earmark-pdf' },
  csv: { label: 'CSV', icon: 'filetype-csv' },
};

type Loaded = { token: string; job?: Job; error?: string; status?: number };

/**
 * Page of an export sent by email: open without signing in, for one hour.
 * The files are plain links, computed by the server when followed.
 */
export default function ExportJob() {
  const { token = '' } = useParams();
  const [loaded, setLoaded] = useState<Loaded>({ token: '' });

  useEffect(() => {
    let cancelled = false;
    fetchExportJob(token)
      .then((job) => { if (!cancelled) setLoaded({ token, job }); })
      .catch((e: unknown) => {
        if (cancelled) return;
        const error = e instanceof StatsError ? e : new StatsError(String(e));
        setLoaded({ token, error: error.message, status: error.status });
      });
    return () => { cancelled = true; };
  }, [token]);

  const { job, error, status } = loaded.token === token ? loaded : { job: undefined, error: undefined, status: undefined };

  return (
    <PageLayout>
      <Container className="py-4">
        {!job && !error && <div className="text-center py-5"><Spinner animation="border" /></div>}

        {error && (
          <div className="text-center py-4">
            <i className="bi bi-hourglass-bottom display-5 text-muted" aria-hidden="true" />
            <h1 className="h4 mt-3">{status === 410 ? 'Ce lien a expiré' : 'Lien invalide'}</h1>
            <p className="text-muted">{error}</p>
            <Link to="/stats" className="btn btn-primary">Ouvrir les statistiques</Link>
          </div>
        )}

        {job && (
          <>
            <h1 className="h4 mb-3">{job.statistic.title}</h1>
            <div className="mb-3">
              {job.summary.map(([label, value]) => <FieldRow key={label} label={label}>{value}</FieldRow>)}
              <FieldRow label="Demandé">
                {job.requested_by ? `${job.requested_by}, à ` : 'À '}{formatTime(job.requested_at)}
              </FieldRow>
            </div>

            <div className="fw-semibold mb-1">Télécharger</div>
            <ListGroup variant="flush" className="mb-3">
              {job.formats.map(({ format, url }) => (
                <ListGroup.Item
                  key={format}
                  action
                  as="a"
                  href={url}
                  target={format === 'pdf' ? '_blank' : undefined}
                  rel="noopener"
                  className="d-flex align-items-center gap-3 px-1 py-2"
                >
                  <i className={`bi bi-${FORMAT_LABELS[format].icon} fs-5 flex-shrink-0`} aria-hidden="true" />
                  <span className="flex-grow-1">{FORMAT_LABELS[format].label}</span>
                </ListGroup.Item>
              ))}
            </ListGroup>

            <div className="small text-muted d-flex align-items-center">
              <span>
                Accès sans connexion jusqu&apos;à {formatTime(job.expires_at)} : ne transférez pas ce lien.
              </span>
              <HelpTip id="export-job-help" title="Lien d'export">
                Les chiffres sont calculés au moment du téléchargement, sur la période et avec les
                droits de la demande. Le lien sert une heure, et {job.downloads_left} téléchargement
                {job.downloads_left > 1 ? 's' : ''} encore.
              </HelpTip>
            </div>
          </>
        )}
      </Container>
    </PageLayout>
  );
}
