import { legend, type GridLayer } from './gridStyle';

interface StatGridLegendProps {
  layer: GridLayer;
  bins?: number[];
  /** `overlay`: floating over the map; `inline`: under it, in the page */
  variant?: 'overlay' | 'inline';
}

/** Colour key of the grid, with what the colours measure. */
export default function StatGridLegend({ layer, bins, variant = 'inline' }: StatGridLegendProps) {
  const title = layer === 'coverage' ? 'Part de la maille couverte' : 'Frelons par piège et par semaine';
  return (
    <div className={`stat-legend stat-legend-${variant}`} aria-label={`Légende : ${title}`}>
      <div className="stat-legend-title">{title}</div>
      <div className="stat-legend-scale">
        {legend(layer, bins).map((entry) => (
          <div key={entry.label} className="stat-legend-step">
            <span className="stat-legend-swatch" style={{ background: entry.color }} aria-hidden="true" />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
