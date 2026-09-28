/** Axis helpers shared by the charts. */

/** A round maximum and its ticks: 0, 25, 50, 75, 100 for a maximum of 87. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(Number(value.toPrecision(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(10)));
  return ticks;
}

const LOCALE = 'fr-BE';
export const tickLabel = (value: number) => value.toLocaleString(LOCALE, { maximumFractionDigits: 2 });

/** Every n-th label, so that labels about `minGap` px wide never touch. */
export function labelStep(count: number, width: number, minGap = 44): number {
  return Math.max(1, Math.ceil((count * minGap) / Math.max(width, 1)));
}

/** Colours of the charts (validated categorical order, one hue for magnitudes). */
export const CHART = {
  primary: '#2a78d6',
  primaryStrong: '#1b5aa6',
  band: '#d6e5f7',
  previous: '#6f6e69',
  grid: 'var(--bs-border-color-translucent)',
  text: 'var(--bs-secondary-color)',
  // Categorical slots in fixed order, checked with the dataviz validator:
  // adjacent pairs pass the colour-blind and normal-vision floors; the
  // neutral "other" is grey on purpose. Legends and the table carry the names.
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#008300'],
  other: '#6f6e69',
};

/** Short axis label of a bucket: `12/03` for a day, `S12` for a week, `mars` for a month. */
export function bucketLabel(bucket: string, start: string, granularity: string | null): string {
  const [year, month, day] = start.split('-').map(Number);
  if (granularity === 'day') return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  if (granularity === 'month') return new Date(year, month - 1, 1).toLocaleDateString(LOCALE, { month: 'short' });
  return bucket;
}
