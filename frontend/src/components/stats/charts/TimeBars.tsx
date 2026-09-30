import { CHART, labelStep, niceTicks, tickLabel } from './scale';
import { useWidth } from './useWidth';

interface TimeBarsProps {
  labels: string[];
  values: (number | null)[];
  selected: number | null;
  onSelect: (index: number) => void;
  ariaLabel: string;
  height?: number;
}

const M = { left: 36, right: 6, top: 8, bottom: 22 };

/** One bar per day, week or month; a tap (or hover) picks a bucket. */
export default function TimeBars({ labels, values, selected, onSelect, ariaLabel, height = 170 }: TimeBarsProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const ticks = niceTicks(Math.max(0, ...values.map((v) => v ?? 0)));
  const max = ticks[ticks.length - 1];
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const step = plotW / Math.max(values.length, 1);
  const barW = Math.max(2, Math.min(24, step - 2));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const every = labelStep(labels.length, plotW);

  return (
    <div ref={ref} className="stat-chart">
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} stroke={CHART.grid} />
            <text x={M.left - 4} y={y(tick) + 3} fontSize="10" textAnchor="end" fill={CHART.text}>{tickLabel(tick)}</text>
          </g>
        ))}
        {values.map((value, i) => {
          if (!value) return null;
          const x = M.left + step * i + (step - barW) / 2;
          const top = y(value);
          const r = Math.min(3, barW / 2, (M.top + plotH - top) / 2);
          const bottom = M.top + plotH;
          return (
            <path
              key={labels[i]}
              d={`M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + barW - r}Q${x + barW} ${top} ${x + barW} ${top + r}V${bottom}Z`}
              fill={i === selected ? CHART.primaryStrong : CHART.primary}
            />
          );
        })}
        {labels.map((label, i) => (i % every === 0 ? (
          <text key={label} x={M.left + step * (i + 0.5)} y={height - 6} fontSize="10" textAnchor="middle" fill={CHART.text}>{label}</text>
        ) : null))}
        {values.map((_, i) => (
          <rect
            key={`hit-${labels[i]}`}
            x={M.left + step * i}
            y={M.top}
            width={step}
            height={plotH}
            fill="transparent"
            onClick={() => onSelect(i)}
            onMouseEnter={() => onSelect(i)}
          />
        ))}
      </svg>
    </div>
  );
}
