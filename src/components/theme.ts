/** Consistent series palette — chosen to stay legible on dark and light
 * chart backgrounds. Series are additionally distinguished by dash pattern
 * in Chart2D so meaning never depends on color perception alone. */
export const COLORS = {
  cyan: '#06b6d4',
  blue: '#4f7dff',
  violet: '#8b5cf6',
  amber: '#d97706',
  red: '#ef4444',
  green: '#10b981',
  slate: '#94a3b8',
} as const;

export type SeriesColor = (typeof COLORS)[keyof typeof COLORS];

/** Default dash cycle applied to successive series in a chart. */
export const DASH_CYCLE: number[][] = [[], [7, 4], [2, 3], [10, 3, 2, 3]];
