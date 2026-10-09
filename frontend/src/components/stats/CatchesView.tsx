import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { HelpTip } from '../common';
import type { StatResult } from '../../utils/statsApi';
import ChartLegend from './charts/ChartLegend';
import { bucketLabel, CHART } from './charts/scale';
import TimeBars from './charts/TimeBars';
import TimeLine from './charts/TimeLine';
import { formatCount, formatRate } from './statParams';

const PAGE = 10;

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** The catches as two charts, each with its own scale: hornets caught, then the rate. */
function CatchesChart({ result }: { result: StatResult }) {
  const { rows, previous } = result;
  // The last bucket with a rate, else the last one
  const [selected, setSelected] = useState<number | null>(() => {
    const index = rows.map((row) => row.rate !== null).lastIndexOf(true);
    return rows.length ? (index >= 0 ? index : rows.length - 1) : null;
  });
  if (rows.length === 0) return <p className="text-muted small my-3">Aucun relevé sur cette période.</p>;
  const labels = rows.map((row) => bucketLabel(String(row.bucket), String(row.start), result.granularity));
  const unit = { day: 'jour', week: 'semaine', month: 'mois' }[result.granularity ?? 'week'];
  const row = selected === null ? null : rows[selected];
  const year = result.period.year ?? result.period.end.slice(0, 4);
  const hasPrevious = Boolean(previous) && rows.some((r) => r.previous_rate !== null && r.previous_rate !== undefined);

  return (
    <>
      <div className="stat-readout small" aria-live="polite">
        {row && (
          <>
            <strong>{result.granularity === 'day' ? row.dates : `${row.bucket} · ${row.dates}`}</strong>
            <br />
            {formatCount(row.hornets)} frelons, {row.traps} piège{Number(row.traps) > 1 ? 's' : ''}
            {' · '}
            {row.rate === null ? 'pas de taux' : (
              <span className="stat-number">
                {formatRate(row.rate)} par piège et par semaine [{formatRate(row.rate_low)}–{formatRate(row.rate_high)}]
              </span>
            )}
            {hasPrevious && row.previous_rate !== null && row.previous_rate !== undefined && (
              <span className="text-muted"> ({previous?.year ?? 'N-1'}{'\u00a0'}: {formatRate(row.previous_rate)})</span>
            )}
          </>
        )}
      </div>

      <h3 className="stat-chart-title">Frelons asiatiques capturés par {unit}</h3>
      <TimeBars
        labels={labels}
        values={rows.map((r) => num(r.hornets))}
        selected={selected}
        onSelect={setSelected}
        ariaLabel={`Barres : frelons asiatiques capturés par ${unit}, ${result.period.label}`}
      />

      <h3 className="stat-chart-title d-flex align-items-center">
        Frelons par piège et par semaine
        <HelpTip id="stat-rate-chart-help" doc="stats#catches" title="Lire la courbe">
          La bande claire est l&apos;intervalle de confiance à 95 % : plus il y a de pièges et de
          relevés, plus elle est étroite. Une différence qui reste dans la bande n&apos;est pas
          significative. Touchez une période pour la détailler.
        </HelpTip>
      </h3>
      <ChartLegend
        items={[
          { label: `${year} et IC 95 %`, color: CHART.primary, mark: 'band' },
          ...(hasPrevious ? [{ label: String(previous?.year ?? 'N-1'), color: CHART.previous, mark: 'dashed' as const }] : []),
        ]}
      />
      <TimeLine
        labels={labels}
        values={rows.map((r) => num(r.rate))}
        low={rows.map((r) => num(r.rate_low))}
        high={rows.map((r) => num(r.rate_high))}
        previous={hasPrevious ? rows.map((r) => num(r.previous_rate)) : null}
        selected={selected}
        onSelect={setSelected}
        ariaLabel={`Courbe : frelons par piège et par semaine, ${result.period.label}${hasPrevious ? `, comparé à ${previous?.label}` : ''}`}
      />
    </>
  );
}

/** One line per day, week or month (a list rather than a table: nothing scrolls sideways). */
function CatchesList({ result }: { result: StatResult }) {
  const [shown, setShown] = useState(PAGE);
  const { rows, previous } = result;
  const unit = { day: 'Jour', week: 'Semaine', month: 'Mois' }[result.granularity ?? 'week'];
  // A day is named by its date; a week or a month by its key, then its days
  const byDay = result.granularity === 'day';

  return (
    <>
      <div className="stat-list-head">
        <span>{unit}</span>
        <span className="d-inline-flex align-items-center">
          Frelons · par piège et par semaine
          <HelpTip id="stat-rate-help" doc="stats#catches" title="Frelons par piège et par semaine">
            Les frelons d&apos;un relevé sont répartis sur les jours écoulés depuis le relevé
            précédent, puis divisés par le nombre de jours où les pièges étaient en place : une
            valeur comparable d&apos;une semaine et d&apos;une année à l&apos;autre, quel que soit le
            nombre de pièges. Entre crochets, l&apos;intervalle de confiance à 95 %.
          </HelpTip>
        </span>
      </div>
      {rows.slice(0, shown).map((row) => (
        <div key={String(row.start)} className="stat-row">
          <div className="min-w-0">
            <div className="fw-semibold">{byDay ? row.dates : row.bucket}</div>
            <div className="small text-muted text-truncate">
              {!byDay && `${row.dates} · `}{row.traps} piège{Number(row.traps) > 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-end flex-shrink-0">
            <div className="fw-bold stat-number">{formatCount(row.hornets)}</div>
            <div className="small stat-number">
              {row.rate === null ? '–' : formatRate(row.rate)}
              {row.rate !== null && (
                <span className="text-muted"> [{formatRate(row.rate_low)}–{formatRate(row.rate_high)}]</span>
              )}
            </div>
            {previous && row.previous_rate !== null && row.previous_rate !== undefined && (
              <div className="small text-muted stat-number">{previous.year ?? 'N-1'} : {formatRate(row.previous_rate)}</div>
            )}
          </div>
        </div>
      ))}
      {rows.length > shown && (
        <Button variant="link" className="w-100" onClick={() => setShown((count) => count + PAGE)}>
          Voir plus ({rows.length - shown})
        </Button>
      )}
    </>
  );
}

/** Asian hornet catches over time: key figures, then the list or the charts. */
export default function CatchesView({ result, chart = false }: { result: StatResult; chart?: boolean }) {
  const { totals, previous } = result;
  return (
    <>
      <div className="stat-kpis mb-3">
        <div className="stat-kpi">
          <div className="stat-kpi-value">{Math.round(Number(totals.hornets)).toLocaleString('fr-BE')}</div>
          <div className="stat-kpi-label">frelons asiatiques</div>
        </div>
        <div className="stat-kpi">
          <div className="stat-kpi-value">{formatRate(totals.rate)}</div>
          <div className="stat-kpi-label">
            par piège et par semaine
            {previous && totals.previous_rate !== null && ` (${previous.year ?? 'N-1'} : ${formatRate(totals.previous_rate)})`}
          </div>
        </div>
        <div className="stat-kpi">
          <div className="stat-kpi-value">{totals.peak_traps}</div>
          <div className="stat-kpi-label">pièges en service au plus fort</div>
        </div>
      </div>
      {chart ? <CatchesChart key={result.computed_at} result={result} /> : <CatchesList result={result} />}
    </>
  );
}
