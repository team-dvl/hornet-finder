import { HelpTip } from '../common';
import type { StatResult, StatRow } from '../../utils/statsApi';
import { formatCount, formatPercent, formatRate } from './statParams';

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
export default function TrapTypesView({ result }: { result: StatResult }) {
  return (
    <>
      <div className="stat-list-head">
        <span>Type de piège</span>
        <span className="d-inline-flex align-items-center">
          Efficacité · sélectivité
          <HelpTip id="stat-types-help" title="Comparer les types de piège">
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
