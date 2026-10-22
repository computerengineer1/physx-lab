/** Number/time formatting helpers shared by all readouts and charts. */

/**
 * Format a number with sensible precision, switching to scientific
 * notation for very large/small magnitudes. Never returns "NaN".
 */
export function formatValue(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-4) return value.toExponential(Math.max(1, digits - 1));
  // Choose decimals so the result has ~`digits` significant figures.
  const mag = Math.floor(Math.log10(abs));
  const decimals = Math.min(6, Math.max(0, digits - 1 - mag));
  return value.toFixed(decimals);
}

export function formatAngleDeg(radians: number, digits = 2): string {
  if (!Number.isFinite(radians)) return '—';
  return `${((radians * 180) / Math.PI).toFixed(digits)}°`;
}

export function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '—';
  return `${t.toFixed(2)} s`;
}

/** Signed formatting, e.g. "+0.42" / "−0.42". */
export function formatSigned(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const s = formatValue(Math.abs(value), digits);
  return `${value < 0 ? '−' : '+'}${s}`;
}

export function clampStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}
