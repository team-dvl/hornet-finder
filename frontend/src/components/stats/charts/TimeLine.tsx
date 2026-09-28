import { useId } from 'react';
import { CHART, labelStep, niceTicks, tickLabel } from './scale';
import { useWidth } from './useWidth';

interface TimeLineProps {
  labels: string[];
  values: (number | null)[];
  low: (number | null)[];
  high: (number | null)[];
  previous?: (number | null)[] | null;
  selected: number | null;
  onSelect: (index: number) => void;
  ariaLabel: string;
  height?: number;
}

const M = { left: 36, right: 6, top: 8, bottom: 22 };

/** Path of the defined points, broken where a value is missing. */
function linePath(xs: number[], ys: (number | null)[]): string {
  let path = '';
  let open = false;
  ys.forEach((value, i) => {
    if (value === null) { open = false; return; }
    path += `${open ? 'L' : 'M'}${xs[i].toFixed(1)} ${value.toFixed(1)}`;
    open = true;
  });
  return path;
}

/** Band between two series, one closed shape per run of defined points. */
function bandPath(xs: number[], lows: (number | null)[], highs: (number | null)[]): string {
  const runs: number[][] = [];
  let run: number[] = [];
  lows.forEach((low, i) => {
    if (low === null || highs[i] === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push(i);
    }
  });
  if (run.length) runs.push(run);
  return runs.map((indexes) => {
    const top = indexes.map((i, k) => `${k ? 'L' : 'M'}${xs[i].toFixed(1)} ${(highs[i] as number).toFixed(1)}`).join('');
    const bottom = [...indexes].reverse().map((i) => `L${xs[i].toFixed(1)} ${(lows[i] as number).toFixed(1)}`).join('');
    return `${top}${bottom}Z`;
  }).join('');
}

/**
 * A rate over time with its 95 % band, and the same period a year before as
 * a dashed line. One axis only: two measures of different scales never share it.
 */
export default function TimeLine({
  labels, values, low, high, previous, selected, onSelect, ariaLabel, height = 170,
}: TimeLineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const clipId = `stat-band-${useId().replace(/:/g, '')}`;
  // Scaled on the values: the band of a bucket with a handful of traps is
  // wide and would flatten the curve, so it may go beyond and is clipped
  const valueMax = Math.max(0, ...[...values, ...(previous ?? [])].map((v) => v ?? 0));
  const bandMax = Math.max(0, ...high.map((v) => v ?? 0));
  const ticks = niceTicks(valueMax > 0 ? Math.min(bandMax, valueMax * 1.5) : bandMax);
  const max = ticks[ticks.length - 1];
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const step = plotW / Math.max(values.length, 1);
  const xs = values.map((_, i) => M.left + step * (i + 0.5));
  const y = (v: number | null) => (v === null ? null : M.top + plotH - (v / max) * plotH);
  const every = labelStep(labels.length, plotW);
  const selectedY = selected === null ? null : y(values[selected]);

  return (
    <div ref={ref} className="stat-chart">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={M.left} x2={width - M.right} y1={y(tick) ?? 0} y2={y(tick) ?? 0} stroke={CHART.grid} />
            <text x={M.left - 4} y={(y(tick) ?? 0) + 3} fontSize="10" textAnchor="end" fill={CHART.text}>{tickLabel(tick)}</text>
          </g>
        ))}
        <clipPath id={clipId}>
          <rect x={M.left} y={M.top} width={plotW} height={plotH} />
        </clipPath>
        <path d={bandPath(xs, low.map(y), high.map(y))} fill={CHART.band} clipPath={`url(#${clipId})`} />
        {previous && (
          <path d={linePath(xs, previous.map(y))} fill="none" stroke={CHART.previous} strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        )}
        <path d={linePath(xs, values.map(y))} fill="none" stroke={CHART.primary} strokeWidth="2" strokeLinejoin="round" />
        {selected !== null && (
          <line x1={xs[selected]} x2={xs[selected]} y1={M.top} y2={M.top + plotH} stroke={CHART.text} strokeOpacity="0.5" />
        )}
        {selected !== null && selectedY !== null && (
          <circle cx={xs[selected]} cy={selectedY} r="5" fill={CHART.primary} stroke="#fff" strokeWidth="2" />
        )}
        {labels.map((label, i) => (i % every === 0 ? (
          <text key={label} x={xs[i]} y={height - 6} fontSize="10" textAnchor="middle" fill={CHART.text}>{label}</text>
        ) : null))}
        {values.map((_, i) => (
          <rect key={`hit-${labels[i]}`} x={M.left + step * i} y={M.top} width={step} height={plotH} fill="transparent"
            onClick={() => onSelect(i)} onMouseEnter={() => onSelect(i)} />
        ))}
      </svg>
    </div>
  );
}
