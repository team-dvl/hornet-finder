import { CHART } from './scale';

export interface LegendItem {
  label: string;
  color: string;
  /** How the series is drawn: a filled swatch, a line, a dashed line, or a line in its band */
  mark?: 'swatch' | 'line' | 'dashed' | 'band';
}

function Mark({ color, mark = 'swatch' }: Pick<LegendItem, 'color' | 'mark'>) {
  if (mark === 'swatch') return <span className="stat-legend-swatch" style={{ background: color }} />;
  return (
    <svg width="22" height="10" aria-hidden="true" className="flex-shrink-0">
      {mark === 'band' && <rect x="0" y="1" width="22" height="8" fill={CHART.band} />}
      <line x1="0" x2="22" y1="5" y2="5" stroke={color} strokeWidth="2" strokeDasharray={mark === 'dashed' ? '4 3' : undefined} />
    </svg>
  );
}

/** Names of the series of a chart, wrapping on a narrow screen. */
export default function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="stat-legend-scale stat-chart-legend">
      {items.map((item) => (
        <span key={item.label} className="stat-legend-step">
          <Mark color={item.color} mark={item.mark} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
