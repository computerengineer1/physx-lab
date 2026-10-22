/**
 * Standing waves — PHYS220 §18.2 (and §18.4 mode shapes).
 *
 * Two identical sinusoidal waves travelling in opposite directions:
 *   y1 = A sin(kx − ωt),  y2 = A sin(kx + ωt)
 * superpose to
 *   y(x, t) = 2A sin(kx) cos(ωt)
 *
 * Nodes: sin(kx) = 0 ⇒ x = mπ/k. Antinodes: x = (m + ½)π/k.
 * For a string of length L fixed at both ends the boundary condition
 * y(0, t) = y(L, t) = 0 forces k L = nπ, i.e. k = nπ/L, λ_n = 2L/n.
 */

import { requireFinite, requirePositive, requirePositiveInteger } from '../shared/validation';

export interface StandingWaveParams {
  /** Amplitude A of each counter-propagating component; envelope peak = 2A. */
  amplitude: number;
  /** Wave number k [rad/m]. */
  waveNumber: number;
  /** Angular frequency ω [rad/s]. */
  angularFrequency: number;
}

export function standingWaveDisplacement(
  { amplitude, waveNumber, angularFrequency }: StandingWaveParams,
  x: number,
  t: number,
): number {
  requireFinite('amplitude', amplitude);
  requirePositive('waveNumber (k)', waveNumber);
  requireFinite('angularFrequency (ω)', angularFrequency);
  requireFinite('x', x);
  requireFinite('t', t);
  return 2 * amplitude * Math.sin(waveNumber * x) * Math.cos(angularFrequency * t);
}

/** Spatial envelope |2A sin(kx)|. */
export function standingWaveEnvelope({ amplitude, waveNumber }: StandingWaveParams, x: number): number {
  return Math.abs(2 * amplitude * Math.sin(waveNumber * x));
}

/** All node positions x = mπ/k within [x0, x1] (inclusive, tolerance-aware). */
export function standingWaveNodes(
  waveNumber: number,
  x0: number,
  x1: number,
): number[] {
  requirePositive('waveNumber (k)', waveNumber);
  requireFinite('x0', x0);
  requireFinite('x1', x1);
  const nodes: number[] = [];
  const mStart = Math.ceil((x0 * waveNumber) / Math.PI - 1e-9);
  const mEnd = Math.floor((x1 * waveNumber) / Math.PI + 1e-9);
  for (let m = mStart; m <= mEnd; m++) {
    const x = (m * Math.PI) / waveNumber;
    nodes.push(x === 0 ? 0 : x); // normalize -0
  }
  return nodes;
}

/** All antinode positions x = (m + ½)π/k within [x0, x1]. */
export function standingWaveAntinodes(
  waveNumber: number,
  x0: number,
  x1: number,
): number[] {
  requirePositive('waveNumber (k)', waveNumber);
  const antinodes: number[] = [];
  const mStart = Math.ceil((x0 * waveNumber) / Math.PI - 0.5 - 1e-9);
  const mEnd = Math.floor((x1 * waveNumber) / Math.PI - 0.5 + 1e-9);
  for (let m = mStart; m <= mEnd; m++) antinodes.push(((m + 0.5) * Math.PI) / waveNumber);
  return antinodes;
}

/**
 * Standing wave for harmonic n of a string of length L fixed at both ends,
 * with wave speed v: k = nπ/L, ω = k v.
 */
export function harmonicStandingParams(
  length: number,
  speed: number,
  n: number,
  amplitude: number,
): StandingWaveParams {
  requirePositive('length (L)', length);
  requirePositive('speed (v)', speed);
  requirePositiveInteger('harmonic n', n);
  requireFinite('amplitude', amplitude);
  const k = (n * Math.PI) / length;
  return { amplitude, waveNumber: k, angularFrequency: k * speed };
}
