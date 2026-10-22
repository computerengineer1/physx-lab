/**
 * Shared validation utilities for all physics calculations.
 *
 * Every physics function validates its inputs and throws a
 * {@link PhysicsInputError} instead of returning NaN/Infinity or
 * silently substituting a plausible-looking number. The UI layer catches
 * these errors and shows an understandable message.
 */

export class PhysicsInputError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'PhysicsInputError';
    this.field = field;
  }
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function requireFinite(field: string, value: number): number {
  if (!isFiniteNumber(value)) {
    throw new PhysicsInputError(
      field,
      `${field} must be a finite real number (received ${String(value)}).`,
    );
  }
  return value;
}

export function requirePositive(field: string, value: number): number {
  requireFinite(field, value);
  if (value <= 0) {
    throw new PhysicsInputError(field, `${field} must be positive (received ${value}).`);
  }
  return value;
}

export function requireNonNegative(field: string, value: number): number {
  requireFinite(field, value);
  if (value < 0) {
    throw new PhysicsInputError(
      field,
      `${field} must be zero or positive (received ${value}).`,
    );
  }
  return value;
}

export function requireInRange(
  field: string,
  value: number,
  min: number,
  max: number,
  opts: { minInclusive?: boolean; maxInclusive?: boolean } = {},
): number {
  const { minInclusive = true, maxInclusive = true } = opts;
  requireFinite(field, value);
  const below = minInclusive ? value < min : value <= min;
  const above = maxInclusive ? value > max : value >= max;
  if (below || above) {
    throw new PhysicsInputError(
      field,
      `${field} must be in [${min}, ${max}] (received ${value}).`,
    );
  }
  return value;
}

export function requirePositiveInteger(field: string, value: number): number {
  requireFinite(field, value);
  if (!Number.isInteger(value) || value < 1) {
    throw new PhysicsInputError(
      field,
      `${field} must be a positive integer (received ${value}).`,
    );
  }
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Relative-equality comparison used for singular-case detection. */
export function nearlyEqual(a: number, b: number, relEps = 1e-9): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= relEps * scale;
}
