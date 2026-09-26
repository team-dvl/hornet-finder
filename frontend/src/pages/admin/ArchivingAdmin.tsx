import { useState } from 'react';
import { Alert, Button, Container, Form } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { ConfirmDialog } from '../../components/ui';
import { useAppDispatch } from '../../store/hooks';
import { bulkArchiveHornets, bulkArchiveNests } from '../../store/store';

/** Years offered for archiving, the current one included */
const YEAR_CHOICES = 10;

/** Archiving of the nests and hornet sightings of a past year, all at once. */
function NestsHornetsSection() {
  const auth = useAuth();
  const dispatch = useAppDispatch();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  // Native select: a wheel on an iPhone, a list on Android
  const years = Array.from({ length: YEAR_CHOICES }, (_, index) => currentYear - index);
  const [confirming, setConfirming] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!auth.user?.access_token) return;

    setIsArchiving(true);
    setError(null);
    setResultMessage(null);

    try {
      const accessToken = auth.user.access_token;
      const [hornetsResult, nestsResult] = await Promise.all([
        dispatch(bulkArchiveHornets({ year, accessToken })).unwrap(),
        dispatch(bulkArchiveNests({ year, accessToken })).unwrap(),
      ]);
      setResultMessage(
        `${hornetsResult.archived_count} frelon(s) et ${nestsResult.archived_count} nid(s) archivés pour ${year}.`
      );
      setConfirming(false);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <section>
      <h2 className="h5 d-flex align-items-center mb-3">
        Nids et vols de frelons
        <HelpTip id="archive-nests-hornets-help" title="Nids et vols de frelons">
          Archive tous les nids et frelons non archivés de l'année indiquée : ils ne sont plus affichés par
          défaut, mais restent visibles sur la carte avec « Afficher les archives ».
        </HelpTip>
      </h2>

      <div className="d-flex flex-wrap align-items-center gap-2">
        <Form.Select
          className="year-select"
          aria-label="Année"
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setResultMessage(null); }}
        >
          {years.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </Form.Select>
        <Button
          variant="warning"
          className="year-select-action"
          onClick={() => { setResultMessage(null); setError(null); setConfirming(true); }}
        >
          <i className="bi bi-archive me-2" aria-hidden="true" />
          Archiver
        </Button>
      </div>

      {resultMessage && <Alert variant="success" className="mt-3 mb-0">{resultMessage}</Alert>}

      <ConfirmDialog
        show={confirming}
        onHide={() => { setConfirming(false); setError(null); }}
        onConfirm={() => void handleConfirm()}
        title={`Archiver ${year} ?`}
        message={`Tous les nids et frelons non archivés de ${year} seront archivés.`}
        confirmLabel="Archiver"
        confirmIcon="archive"
        variant="warning"
        busy={isArchiving}
        error={error}
      />
    </section>
  );
}

/**
 * Archiving module (administrators): one section per kind of data that can be
 * archived by year.
 */
export default function ArchivingAdmin() {
  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Archivage" help="Archivez les données d'une année écoulée." />
        <NestsHornetsSection />
      </Container>
    </PageLayout>
  );
}
