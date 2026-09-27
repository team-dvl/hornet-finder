import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { HelpTip } from '../common';
import type { StatResult } from '../../utils/statsApi';
import { formatCount, formatRate } from './statParams';

const PAGE = 10;

/**
 * Asian hornet catches over time: key figures, then one line per day, week or
 * month (a list rather than a table, so nothing scrolls sideways on a phone).
 */
export default function CatchesView({ result }: { result: StatResult }) {
  const [shown, setShown] = useState(PAGE);
  const { rows, totals, previous } = result;
  const unit = { day: 'Jour', week: 'Semaine', month: 'Mois' }[result.granularity ?? 'week'];
  // A day is named by its date; a week or a month by its key, then its days
  const byDay = result.granularity === 'day';

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

      <div className="stat-list-head">
        <span>{unit}</span>
        <span className="d-inline-flex align-items-center">
          Frelons · par piège et par semaine
          <HelpTip id="stat-rate-help" title="Frelons par piège et par semaine">
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
