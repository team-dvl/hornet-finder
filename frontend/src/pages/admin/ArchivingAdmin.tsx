import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Form, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { ConfirmDialog } from '../../components/ui';
import { archiveChoices, bulkArchive, fetchArchiveCandidates } from '../../utils/archiveApi';

interface Candidates {
  hornets: number;
  nests: number;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const describe = ({ hornets, nests }: Candidates) =>
  `${plural(hornets, 'frelon', 'frelons')} et ${plural(nests, 'nid', 'nids')}`;

/** Archiving of the nests and hornet sightings of a season or a year that is over. */
function NestsHornetsSection() {
  // Native select: a wheel on an iPhone, a list on Android
  const choices = useMemo(() => archiveChoices(), []);
  const [choiceId, setChoiceId] = useState(choices[0]?.id ?? '');
  const choice = choices.find(({ id }) => id === choiceId);

  // The count is tied to the request that made it: a stale one reads as "counting"
  const [count, setCount] = useState<{ key: string; candidates?: Candidates; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  // Bumped after an archiving to count again
  const [refresh, setRefresh] = useState(0);

  const countKey = `${choiceId}:${refresh}`;

  useEffect(() => {
    if (!choice) return;
    let current = true;
    Promise.all([fetchArchiveCandidates('hornets', choice), fetchArchiveCandidates('nests', choice)])
      .then(([hornets, nests]) => { if (current) setCount({ key: countKey, candidates: { hornets, nests } }); })
      .catch((err: Error) => { if (current) setCount({ key: countKey, error: err.message }); });
    return () => { current = false; };
  }, [choice, countKey]);

  const fresh = count?.key === countKey ? count : null;
  const candidates = fresh?.candidates ?? null;
  const countError = fresh?.error ?? null;

  const total = candidates ? candidates.hornets + candidates.nests : 0;

  const handleConfirm = async () => {
    if (!choice) return;
    setIsArchiving(true);
    setError(null);
    try {
      const [hornets, nests] = await Promise.all([bulkArchive('hornets', choice), bulkArchive('nests', choice)]);
      setResultMessage(`${describe({ hornets, nests })} archivés : ${choice.label}.`);
      setConfirming(false);
      setRefresh((count) => count + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <section>
      <h2 className="h5 d-flex align-items-center mb-3">
        Nids et vols de frelons
        <HelpTip id="archive-nests-hornets-help" title="Nids et vols de frelons">
          Archive les nids et frelons non archivés d'une saison ou d'une année terminée, avec les mêmes
          périodes que les statistiques (l'été est inclus dans « Été-automne-hiver »). Les objets archivés ne
          sont plus affichés par défaut, mais restent visibles sur la carte avec « Afficher les archives ».
        </HelpTip>
      </h2>

      {choice ? (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Select
              className="year-select"
              aria-label="Période à archiver"
              value={choiceId}
              onChange={(e) => { setChoiceId(e.target.value); setResultMessage(null); }}
            >
              {choices.map(({ id, label, dates }) => <option key={id} value={id}>{label} ({dates})</option>)}
            </Form.Select>
            <Button
              variant="warning"
              className="year-select-action"
              disabled={total === 0}
              onClick={() => { setResultMessage(null); setError(null); setConfirming(true); }}
            >
              <i className="bi bi-archive me-2" aria-hidden="true" />
              Archiver
            </Button>
          </div>

          <p className="mt-3 mb-0" aria-live="polite">
            {countError ? <span className="text-danger">{countError}</span>
              : candidates ? (total > 0 ? `À archiver : ${describe(candidates)}.` : 'Rien à archiver.')
              : <Spinner size="sm" animation="border" role="status" aria-label="Décompte en cours" />}
          </p>
        </>
      ) : (
        <p className="mb-0">Aucune période terminée à archiver.</p>
      )}

      {resultMessage && <Alert variant="success" className="mt-3 mb-0">{resultMessage}</Alert>}

      <ConfirmDialog
        show={confirming}
        onHide={() => { setConfirming(false); setError(null); }}
        onConfirm={() => void handleConfirm()}
        title={`Archiver ${choice?.label} ?`}
        message={candidates ? `${describe(candidates)} de cette période seront archivés.` : ''}
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
 * archived by season or year.
 */
export default function ArchivingAdmin() {
  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Archivage" help="Archivez les données d'une saison ou d'une année écoulée." />
        <NestsHornetsSection />
      </Container>
    </PageLayout>
  );
}
