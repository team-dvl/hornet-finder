import { useEffect, useState } from 'react';
import { Alert, Container, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { ModuleCard } from '../../components/home';
import { fetchStatCatalogue, StatsError, type StatDescription } from '../../utils/statsApi';

/** Icon of each statistic of the catalogue (bootstrap-icons). */
const STAT_ICONS: Record<string, string> = {
  'traps-catches': 'bi-graph-up',
  'trap-types': 'bi-columns-gap',
  'traps-coverage': 'bi-grid-3x3',
  'traps-pressure': 'bi-bullseye',
};

/** Catalogue of the statistics the user may open. */
export default function StatsIndex() {
  const [catalogue, setCatalogue] = useState<StatDescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatCatalogue()
      .then(setCatalogue)
      .catch((e: unknown) => setError(e instanceof StatsError ? e.message : String(e)));
  }, []);

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Statistiques" help="Captures, efficacité des pièges et couverture du territoire." />
        {error && <Alert variant="danger">{error}</Alert>}
        {!catalogue && !error && <div className="text-center py-4"><Spinner animation="border" /></div>}
        {catalogue && (
          <>
            <h2 className="stat-section-title">Piégeage</h2>
            <div className="tile-grid">
              {catalogue.map((stat) => (
                <ModuleCard
                  key={stat.id}
                  title={stat.title}
                  description={stat.description}
                  icon={STAT_ICONS[stat.id] ?? 'bi-bar-chart-line'}
                  to={`/stats/${stat.id}`}
                />
              ))}
            </div>
          </>
        )}
      </Container>
    </PageLayout>
  );
}
