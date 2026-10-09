import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { HelpTip } from '../common';
import type { StatResult, StatRow } from '../../utils/statsApi';
import ForestPlot from './charts/ForestPlot';
import { formatCount, formatRate } from './statParams';

const PAGE = 10;
/** Traps drawn on the chart: beyond, the points no longer fit a phone */
const CHARTED = 15;

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const trapLabel = (row: StatRow) => `#${row.id}${row.address ? ` ${row.address}` : ''}`;

function RankRow({ row, rank, byRate }: { row: StatRow; rank: number; byRate: boolean }) {
  const rate = row.rate === null ? '–' : formatRate(row.rate);
  return (
    <div className="stat-row">
      <div className="min-w-0">
        <div className="fw-semibold text-truncate">
          <span className="text-muted stat-number">{rank}.</span> {trapLabel(row)}
        </div>
        <div className="small text-muted text-truncate">
          {row.type} · {row.readings} relevé{Number(row.readings) > 1 ? 's' : ''} · {formatCount(row.trap_days)} j
        </div>
      </div>
      <div className="text-end flex-shrink-0">
        <div className="fw-bold stat-number">{byRate ? rate : formatCount(row.hornets)}</div>
        <div className="small text-muted stat-number">
          {byRate ? `${formatCount(row.hornets)} frelons` : `${rate} / sem.`}
        </div>
      </div>
    </div>
  );
}

/** Traps ranked by their catches: only those the user sees on the map. */
export default function TrapRankingView({ result, chart = false }: { result: StatResult; chart?: boolean }) {
  const [shown, setShown] = useState(PAGE);
  const byRate = result.order !== 'hornets';
  const { rows } = result;

  if (rows.length === 0) return <p className="text-muted small my-3">Aucun relevé sur cette période.</p>;

  if (chart) {
    const top = rows.slice(0, CHARTED);
    return (
      <>
        <h3 className="stat-chart-title d-flex align-items-center">
          Frelons par semaine, {top.length < rows.length ? `${top.length} premiers pièges` : 'par piège'}
          <HelpTip id="stat-ranking-chart-help" doc="stats#ranking" title="Lire le graphique">
            Un point par piège, dans l&apos;ordre du classement ; le trait couvre l&apos;intervalle de
            confiance à 95 %. Un piège en place depuis moins de 7 jours n&apos;a pas de taux : trop
            peu de données.
          </HelpTip>
        </h3>
        <ForestPlot
          rows={top.map((row) => ({
            key: String(row.id),
            label: trapLabel(row),
            value: num(row.rate),
            low: num(row.rate_low),
            high: num(row.rate_high),
          }))}
          ariaLabel="Frelons asiatiques par semaine, piège par piège, avec intervalle de confiance"
        />
      </>
    );
  }

  return (
    <>
      <div className="stat-list-head">
        <span>Piège</span>
        <span className="d-inline-flex align-items-center">
          {byRate ? 'Frelons par semaine' : 'Frelons capturés'}
          <HelpTip id="stat-ranking-help" doc="stats#ranking" title="Pièges les plus actifs">
            {byRate
              ? 'Classés par frelons asiatiques capturés par semaine de présence, ce qui ne favorise pas les pièges posés plus tôt. Un piège en place depuis moins de 7 jours n’est pas classé. '
              : 'Classés par frelons asiatiques capturés sur la période. '}
            Seuls les pièges que vous voyez sur la carte figurent dans ce classement.
          </HelpTip>
        </span>
      </div>
      {rows.slice(0, shown).map((row, index) => (
        <RankRow key={String(row.id)} row={row} rank={index + 1} byRate={byRate} />
      ))}
      {rows.length > shown && (
        <Button variant="link" className="w-100" onClick={() => setShown((count) => count + PAGE)}>
          Voir plus ({rows.length - shown})
        </Button>
      )}
    </>
  );
}
