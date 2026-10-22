/**
 * Waves on strings — PHYS220 §16.3–§16.4 and §18.4 boundary conditions.
 *
 *   v = √(T_s / μ)              (T_s = tension [N], μ = linear mass density [kg/m])
 *   P_avg = ½ μ ω² A² v         (time-averaged power of a sinusoidal wave [W])
 *
 * String fixed at both ends (length L):
 *   λ_n = 2L/n,   f_n = n v / (2L),   n = 1, 2, 3, …
 *   nodes at x = m L/n (m = 0…n); antinodes at x = (2m−1)L/(2n).
 */

import {
  requireFinite,
  requirePositive,
  requirePositiveInteger,
} from '../shared/validation';

/** Ideal stretched-string wave speed v = √(T_s/μ) [m/s]. */
export function stringWaveSpeed(tension: number, linearDensity: number): number {
  requirePositive('tension', tension);
  requirePositive('linearDensity (μ)', linearDensity);
  return Math.sqrt(tension / linearDensity);
}

export interface WavePowerInputs {
  /** Linear mass density μ [kg/m]. */
  linearDensity: number;
  /** Angular frequency ω [rad/s]. */
  angularFrequency: number;
  /** Transverse amplitude A [m]. */
  amplitude: number;
  /** Propagation speed v [m/s]. */
  speed: number;
}

/** P_avg = ½ μ ω² A² v [W]. */
export function averageWavePower({
  linearDensity,
  angularFrequency,
  amplitude,
  speed,
}: WavePowerInputs): number {
  requirePositive('linearDensity (μ)', linearDensity);
  requireFinite('angularFrequency (ω)', angularFrequency);
  requireFinite('amplitude (A)', amplitude);
  requirePositive('speed (v)', speed);
  return 0.5 * linearDensity * angularFrequency ** 2 * amplitude ** 2 * speed;
}

/** λ_n = 2L/n [m]. */
export function harmonicWavelength(length: number, n: number): number {
  requirePositive('length (L)', length);
  requirePositiveInteger('harmonic n', n);
  return (2 * length) / n;
}

/** f_n = n v / (2L) [Hz]. */
export function harmonicFrequency(length: number, speed: number, n: number): number {
  requirePositive('length (L)', length);
  requirePositive('speed (v)', speed);
  requirePositiveInteger('harmonic n', n);
  return (n * speed) / (2 * length);
}

export function fundamentalFrequency(length: number, speed: number): number {
  return harmonicFrequency(length, speed, 1);
}

/** Which harmonic is closest to a driving frequency (informational). */
export function nearestHarmonic(length: number, speed: number, frequency: number): number {
  requirePositive('frequency', frequency);
  const f1 = fundamentalFrequency(length, speed);
  return Math.max(1, Math.round(frequency / f1));
}

/**
 * Node positions x = m·L/n for m = 0…n (both endpoints included)
 * for a string of length L vibrating in harmonic n.
 */
export function fixedEndNodePositions(length: number, n: number): number[] {
  requirePositive('length (L)', length);
  requirePositiveInteger('harmonic n', n);
  const positions: number[] = [];
  for (let m = 0; m <= n; m++) positions.push((m * length) / n);
  return positions;
}

/** Antinode positions x = (2m−1)L/(2n) for m = 1…n. */
export function fixedEndAntinodePositions(length: number, n: number): number[] {
  requirePositive('length (L)', length);
  requirePositiveInteger('harmonic n', n);
  const positions: number[] = [];
  for (let m = 1; m <= n; m++) positions.push(((2 * m - 1) * length) / (2 * n));
  return positions;
}
