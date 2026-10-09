import { useState } from 'react';
import { HelpTip } from '../common';
import type { StatResult, StatRow } from '../../utils/statsApi';
import ChartLegend from './charts/ChartLegend';
import { bucketLabel, CHART } from './charts/scale';
import StackedShares, { type ShareSeries } from './charts/StackedShares';
import { formatCount, formatPercent } from './statParams';

function SpeciesRow({ row, total = false }: { row: StatRow; total?: boolean }) {
  return (
    <div className={`stat-row ${total ? 'stat-row-total' : ''}`}>
      <div className="min-w-0">
        <div className="fw-semibold text-truncate">{row.name}</div>
        {row.scientific_name && <div className="small text-muted fst-italic text-truncate">{row.scientific_name}</div>}
        {total && (
          <div className="small text-muted">
            {row.complete_readings} relevé{Number(row.complete_readings) > 1 ? 's' : ''} complet{Number(row.complete_readings) > 1 ? 's' : ''} sur {row.readings}
          </div>
        )}
      </div>
      <div className="text-end flex-shrink-0">
        <div className="fw-bold stat-number">{formatCount(row.catches)}</div>
        {!total && (
          <div className="small stat-number">
            {row.share === null ? <span className="text-muted">–</span> : (
              <>
                {formatPercent(row.share)}
                <span className="text-muted"> [{formatPercent(row.share_low)}–{formatPercent(row.share_high)}]</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Share of each species among the insects counted, bucket by bucket. */
function SpeciesChart({ result }: { result: StatResult }) {
  const buckets = result.series?.buckets ?? [];
  const series: ShareSeries[] = (result.series?.species ?? []).map((species, index) => ({
    key: species.slug,
    name: species.name,
    color: species.slug === 'other' ? CHART.other : CHART.series[index % CHART.series.length],
  }));
  const [selected, setSelected] = useState<number | null>(() => {
    const index = buckets.map((b) => b.counted > 0).lastIndexOf(true);
    return index >= 0 ? index : null;
  });
  if (series.length === 0) {
    return <p className="text-muted small my-3">Aucun relevé où toutes les espèces ont été comptées.</p>;
  }
  const bucket = selected === null ? null : buckets[selected];

  return (
    <>
      <div className="stat-readout small" aria-live="polite">
        {bucket && (
          <>
            <strong>{result.granularity === 'day' ? bucket.dates : `${bucket.bucket} · ${bucket.dates}`}</strong>
            {' · '}
            {bucket.counted ? `${formatCount(bucket.counted)} insectes comptés` : 'aucun relevé complet'}
            {bucket.counted > 0 && (
              <div className="stat-number">
                {series
                  .filter((s) => (bucket.shares[s.key] ?? 0) > 0)
                  .map((s) => `${s.name} ${formatPercent(bucket.shares[s.key])}`)
                  .join(' · ')}
              </div>
            )}
          </>
        )}
      </div>
      <h3 className="stat-chart-title d-flex align-items-center">
        Part de chaque espèce parmi les insectes comptés
        <HelpTip id="stat-species-chart-help" doc="stats#species" title="Lire le graphique">
          Sur les seuls relevés où toutes les espèces ont été comptées. Une barre vide : aucun
          relevé complet sur cette période. Touchez une barre pour la détailler.
        </HelpTip>
      </h3>
      <ChartLegend items={series.map((s) => ({ label: s.name, color: s.color }))} />
      <StackedShares
        labels={buckets.map((b) => bucketLabel(b.bucket, b.start, result.granularity))}
        series={series}
        shares={buckets.map((b) => b.shares)}
        selected={selected}
        onSelect={setSelected}
        ariaLabel={`Barres empilées : part de chaque espèce parmi les insectes comptés, ${result.period.label}`}
      />
    </>
  );
}

/** Catches per species: Asian hornets first, then the bycatch. */
export default function TrapSpeciesView({ result, chart = false }: { result: StatResult; chart?: boolean }) {
  if (chart) return <SpeciesChart key={result.computed_at} result={result} />;
  return (
    <>
      <div className="stat-list-head">
        <span>Espèce</span>
        <span className="d-inline-flex align-items-center">
          Captures · part
          <HelpTip id="stat-species-help" doc="stats#species" title="Captures par espèce">
            Les captures comptent tous les relevés. La part d&apos;une espèce parmi les insectes
            comptés ne porte que sur les relevés où toutes les espèces ont été comptées, à partir de
            20 insectes. Entre crochets, l&apos;intervalle de confiance à 95 %.
          </HelpTip>
        </span>
      </div>
      {result.rows.length === 0 && <p className="text-muted small my-3">Aucun relevé sur cette période.</p>}
      {result.rows.map((row) => <SpeciesRow key={String(row.slug)} row={row} />)}
      {result.rows.length > 0 && <SpeciesRow row={result.totals} total />}
    </>
  );
}
