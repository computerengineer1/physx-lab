/**
 * Dimensional analysis toolkit — supporting material for Module A
 * (Mathematical Revision). Tracks base dimensions M (mass), L (length),
 * T (time) so students can check that equations are dimensionally
 * consistent before plugging in numbers.
 */

export interface Dimensions {
  /** Exponent of mass M. */
  M: number;
  /** Exponent of length L. */
  L: number;
  /** Exponent of time T. */
  T: number;
}

export const DIMENSIONLESS: Dimensions = { M: 0, L: 0, T: 0 };
export const LENGTH: Dimensions = { M: 0, L: 1, T: 0 };
export const TIME: Dimensions = { M: 0, L: 0, T: 1 };
export const MASS: Dimensions = { M: 1, L: 0, T: 0 };
export const VELOCITY: Dimensions = { M: 0, L: 1, T: -1 };
export const ACCELERATION: Dimensions = { M: 0, L: 1, T: -2 };
export const FORCE: Dimensions = { M: 1, L: 1, T: -2 };
export const ENERGY: Dimensions = { M: 1, L: 2, T: -2 };
export const POWER: Dimensions = { M: 1, L: 2, T: -3 };
export const SPRING_CONSTANT: Dimensions = { M: 1, L: 0, T: -2 };
export const LINEAR_DENSITY: Dimensions = { M: 1, L: -1, T: 0 };
export const FREQUENCY: Dimensions = { M: 0, L: 0, T: -1 };
export const WAVE_NUMBER: Dimensions = { M: 0, L: -1, T: 0 };

export interface DimensionedQuantity {
  name: string;
  symbol: string;
  unit: string;
  dimensions: Dimensions;
}

/** Library of PHYS220 quantities used by the revision tools. */
export const QUANTITY_LIBRARY: DimensionedQuantity[] = [
  { name: 'Distance / amplitude / wavelength', symbol: 'x, A, λ', unit: 'm', dimensions: LENGTH },
  { name: 'Time / period', symbol: 't, T', unit: 's', dimensions: TIME },
  { name: 'Frequency', symbol: 'f', unit: 'Hz = 1/s', dimensions: FREQUENCY },
  { name: 'Angular frequency', symbol: 'ω', unit: 'rad/s', dimensions: FREQUENCY },
  { name: 'Wave number', symbol: 'k', unit: 'rad/m', dimensions: WAVE_NUMBER },
  { name: 'Mass', symbol: 'm', unit: 'kg', dimensions: MASS },
  { name: 'Velocity / wave speed', symbol: 'v', unit: 'm/s', dimensions: VELOCITY },
  { name: 'Acceleration', symbol: 'a', unit: 'm/s²', dimensions: ACCELERATION },
  { name: 'Force / tension', symbol: 'F, Tₛ', unit: 'N = kg·m/s²', dimensions: FORCE },
  { name: 'Spring constant', symbol: 'k', unit: 'N/m', dimensions: SPRING_CONSTANT },
  { name: 'Energy', symbol: 'E, K, U', unit: 'J = kg·m²/s²', dimensions: ENERGY },
  { name: 'Power', symbol: 'P', unit: 'W = kg·m²/s³', dimensions: POWER },
  { name: 'Linear mass density', symbol: 'μ', unit: 'kg/m', dimensions: LINEAR_DENSITY },
  { name: 'Refractive index', symbol: 'n', unit: '(dimensionless)', dimensions: DIMENSIONLESS },
];

export function mulDimensions(a: Dimensions, b: Dimensions): Dimensions {
  return { M: a.M + b.M, L: a.L + b.L, T: a.T + b.T };
}

export function divDimensions(a: Dimensions, b: Dimensions): Dimensions {
  return { M: a.M - b.M, L: a.L - b.L, T: a.T - b.T };
}

export function powDimensions(a: Dimensions, p: number): Dimensions {
  return { M: a.M * p, L: a.L * p, T: a.T * p };
}

export function dimensionsEqual(a: Dimensions, b: Dimensions, eps = 1e-9): boolean {
  return (
    Math.abs(a.M - b.M) < eps && Math.abs(a.L - b.L) < eps && Math.abs(a.T - b.T) < eps
  );
}

export function isDimensionless(a: Dimensions): boolean {
  return dimensionsEqual(a, DIMENSIONLESS);
}

/** Format as e.g. "M¹ L² T⁻³" (or "dimensionless"). */
export function formatDimensions(d: Dimensions): string {
  if (isDimensionless(d)) return 'dimensionless';
  const sup = (n: number): string =>
    String(Math.abs(n))
      .split('')
      .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)])
      .join('');
  const part = (sym: string, e: number) => {
    if (e === 0) return null;
    if (e === 1) return sym;
    return e < 0 ? `${sym}⁻${sup(e)}` : `${sym}${sup(e)}`;
  };
  const parts = [part('M', d.M), part('L', d.L), part('T', d.T)].filter(Boolean);
  return parts.length ? parts.join(' ') : 'dimensionless';
}

/**
 * Check that all additive terms of an equation share the same dimensions.
 * `terms` is one entry per additive term; each entry lists the factors that
 * are multiplied together in that term.
 */
export function checkEquationConsistency(
  terms: Dimensions[][],
): { consistent: boolean; termDimensions: Dimensions[] } {
  if (terms.length === 0) return { consistent: true, termDimensions: [] };
  const termDimensions = terms.map((factors) =>
    factors.reduce<Dimensions>((acc, f) => mulDimensions(acc, f), DIMENSIONLESS),
  );
  const consistent = termDimensions.every((d) => dimensionsEqual(d, termDimensions[0]));
  return { consistent, termDimensions };
}
