import { HelpTip } from '../common';
import type { StatResult, StatRow } from '../../utils/statsApi';
import ForestPlot, { type ForestRow } from './charts/ForestPlot';
import { formatCount, formatPercent, formatRate } from './statParams';

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** One point per type with its interval: efficiency, then selectivity. */
function TrapTypesChart({ rows }: { rows: StatRow[] }) {
  const forest = (key: string): ForestRow[] => rows.map((row) => ({
    key: String(row.slug),
    label: String(row.name),
    value: num(row[key]),
    low: num(row[`${key}_low`]),
    high: num(row[`${key}_high`]),
  }));
  return (
    <>
      <h3 className="stat-chart-title d-flex align-items-center">
        Frelons par piège et par semaine
        <HelpTip id="stat-types-chart-help" doc="stats#trap-types" title="Lire le graphique">
          Un point par type de piège ; le trait couvre l&apos;intervalle de confiance à 95 %. Deux
          types dont les traits se chevauchent largement ne sont pas départagés.
        </HelpTip>
      </h3>
      <ForestPlot rows={forest('rate')} ariaLabel="Frelons par piège et par semaine, par type de piège, avec intervalle de confiance" />
      <h3 className="stat-chart-title">Sélectivité (part de frelons asiatiques)</h3>
      <ForestPlot rows={forest('selectivity')} max={1} format={(v) => formatPercent(v)} ariaLabel="Sélectivité par type de piège, avec intervalle de confiance" />
    </>
  );
}

function TypeRow({ row, total = false }: { row: StatRow; total?: boolean }) {
  return (
    <div className={`stat-row d-block ${total ? 'stat-row-total' : ''}`}>
      <div className="fw-semibold text-truncate">{row.name}</div>
      <div className="small text-muted">
        {row.traps} piège{Number(row.traps) > 1 ? 's' : ''} · {formatCount(row.hornets)} frelons
      </div>
      <div className="stat-pair mt-1">
        <div>
          <div className="small text-muted">Par piège et par semaine</div>
          <div className="stat-number">
            <strong>{formatRate(row.rate)}</strong>
            {row.rate !== null && <span className="text-muted small"> [{formatRate(row.rate_low)}–{formatRate(row.rate_high)}]</span>}
          </div>
        </div>
        <div>
          <div className="small text-muted">Sélectivité</div>
          <div className="stat-number">
            {row.selectivity === null ? (
              <span className="text-muted small">{row.counted_insects} insectes comptés</span>
            ) : (
              <>
                <strong>{formatPercent(row.selectivity)}</strong>
                <span className="text-muted small"> [{formatPercent(row.selectivity_low)}–{formatPercent(row.selectivity_high)}]</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Trap types compared: catches per trap (efficiency) and share of Asian hornets (selectivity). */
export default function TrapTypesView({ result, chart = false }: { result: StatResult; chart?: boolean }) {
  if (chart && result.rows.length > 0) return <TrapTypesChart rows={result.rows} />;
  return (
    <>
      <div className="stat-list-head">
        <span>Type de piège</span>
        <span className="d-inline-flex align-items-center">
          Efficacité · sélectivité
          <HelpTip id="stat-types-help" doc="stats#trap-types" title="Comparer les types de piège">
            L&apos;efficacité est le nombre de frelons asiatiques par piège et par semaine. La
            sélectivité est la part de frelons asiatiques parmi les insectes comptés, sur les seuls
            relevés où toutes les espèces ont été comptées ; elle n&apos;est donnée qu&apos;à partir
            de 20 insectes. Entre crochets, l&apos;intervalle de confiance à 95 % : deux types dont
            les intervalles se chevauchent largement ne sont pas départagés.
          </HelpTip>
        </span>
      </div>
      {result.rows.length === 0 && <p className="text-muted small my-3">Aucun relevé sur cette période.</p>}
      {result.rows.map((row) => <TypeRow key={String(row.slug)} row={row} />)}
      {result.rows.length > 1 && <TypeRow row={result.totals} total />}
    </>
  );
}
