import { CHART, niceTicks, tickLabel } from './scale';
import { useWidth } from './useWidth';

export interface ForestRow {
  key: string;
  label: string;
  value: number | null;
  low: number | null;
  high: number | null;
}

interface ForestPlotProps {
  rows: ForestRow[];
  /** Upper end of the axis; computed from the intervals when absent */
  max?: number;
  /** Label of an axis tick */
  format?: (value: number) => string;
  ariaLabel: string;
}

const ROW = 32;
const AXIS = 22;

/**
 * One point per row with its 95 % interval as a line. Rows are compared by
 * their intervals: two that overlap widely are not told apart.
 */
export default function ForestPlot({ rows, max, format = tickLabel, ariaLabel }: ForestPlotProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const labelW = Math.min(150, Math.round(width * 0.38));
  const right = 12;
  const ticks = max !== undefined ? niceTicks(max) : niceTicks(Math.max(0, ...rows.map((r) => r.high ?? r.value ?? 0)));
  const top = ticks[ticks.length - 1];
  const plotW = width - labelW - right;
  const x = (v: number) => labelW + (Math.min(v, top) / top) * plotW;
  const height = rows.length * ROW + AXIS;
  const chars = Math.floor((labelW - 8) / 6.6);

  return (
    <div ref={ref} className="stat-chart">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((tick, i) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={0} y2={rows.length * ROW} stroke={CHART.grid} />
            {/* The last label ends on its line, inside the chart */}
            <text x={x(tick)} y={height - 6} fontSize="10" textAnchor={i === ticks.length - 1 ? 'end' : 'middle'} fill={CHART.text}>
              {format(tick)}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const cy = i * ROW + ROW / 2;
          const label = row.label.length > chars ? `${row.label.slice(0, chars - 1)}…` : row.label;
          return (
            <g key={row.key}>
              <text x={0} y={cy + 4} fontSize="12" fill="currentColor">
                <title>{row.label}</title>
                {label}
              </text>
              {row.low !== null && row.high !== null && (
                <line x1={x(row.low)} x2={x(row.high)} y1={cy} y2={cy} stroke={CHART.primary} strokeWidth="2" strokeLinecap="round" />
              )}
              {row.value !== null ? (
                <circle cx={x(row.value)} cy={cy} r="5" fill={CHART.primary} stroke="#fff" strokeWidth="2" />
              ) : (
                <text x={labelW + 4} y={cy + 4} fontSize="11" fill={CHART.text}>trop peu de données</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
