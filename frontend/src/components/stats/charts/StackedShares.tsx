import { CHART, labelStep } from './scale';
import { useWidth } from './useWidth';

export interface ShareSeries {
  key: string;
  name: string;
  color: string;
}

interface StackedSharesProps {
  labels: string[];
  series: ShareSeries[];
  /** Per bucket: share of each series (0 to 1), null when nothing was counted */
  shares: Record<string, number | null>[];
  selected: number | null;
  onSelect: (index: number) => void;
  ariaLabel: string;
  height?: number;
}

const M = { left: 36, right: 6, top: 8, bottom: 22 };
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/** 100 % stacked bars: the share of each species, bucket by bucket. */
export default function StackedShares({
  labels, series, shares, selected, onSelect, ariaLabel, height = 190,
}: StackedSharesProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const step = plotW / Math.max(labels.length, 1);
  const barW = Math.max(2, Math.min(24, step - 2));
  const every = labelStep(labels.length, plotW);

  return (
    <div ref={ref} className="stat-chart">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {TICKS.map((tick) => {
          const y = M.top + plotH - tick * plotH;
          return (
            <g key={tick}>
              <line x1={M.left} x2={width - M.right} y1={y} y2={y} stroke={CHART.grid} />
              <text x={M.left - 4} y={y + 3} fontSize="10" textAnchor="end" fill={CHART.text}>{Math.round(tick * 100)} %</text>
            </g>
          );
        })}
        {shares.map((bucket, i) => {
          const x = M.left + step * i + (step - barW) / 2;
          let base = M.top + plotH;
          return (
            <g key={labels[i]} opacity={selected === null || selected === i ? 1 : 0.55}>
              {series.map((serie) => {
                const share = bucket[serie.key] ?? 0;
                if (share <= 0) return null;
                const h = share * plotH;
                base -= h;
                // A 1 px gap keeps neighbouring segments apart
                return <rect key={serie.key} x={x} y={base} width={barW} height={Math.max(0, h - 1)} fill={serie.color} />;
              })}
            </g>
          );
        })}
        {labels.map((label, i) => (i % every === 0 ? (
          <text key={label} x={M.left + step * (i + 0.5)} y={height - 6} fontSize="10" textAnchor="middle" fill={CHART.text}>{label}</text>
        ) : null))}
        {labels.map((label, i) => (
          <rect key={`hit-${label}`} x={M.left + step * i} y={M.top} width={step} height={plotH} fill="transparent"
            onClick={() => onSelect(i)} onMouseEnter={() => onSelect(i)} />
        ))}
      </svg>
    </div>
  );
}
