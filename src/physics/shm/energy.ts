/**
 * Energy of the simple harmonic oscillator — PHYS220 §15.3.
 *
 *   U_s = ½ k x²      (spring potential energy)
 *   K   = ½ m v²      (kinetic energy)
 *   E   = K + U_s = ½ k A²   (constant for the ideal oscillator)
 *
 * SI units: energies [J], k [N/m], m [kg], x [m], v [m/s], A [m].
 */

import { requireFinite, requireNonNegative, requirePositive } from '../shared/validation';
import { calculateShmState, shmAngularFrequency } from '../shm/shm';
import type { ShmSolution, SpringOscillator } from '../shm/shm';

export function kineticEnergy(m: number, v: number): number {
  requirePositive('m', m);
  requireFinite('v', v);
  return 0.5 * m * v * v;
}

export function springPotentialEnergy(k: number, x: number): number {
  requirePositive('k', k);
  requireFinite('x', x);
  return 0.5 * k * x * x;
}

/** Total mechanical energy of an ideal oscillator: E = ½ k A². */
export function totalOscillatorEnergy(k: number, amplitude: number): number {
  requirePositive('k', k);
  requireNonNegative('amplitude', amplitude);
  return 0.5 * k * amplitude * amplitude;
}

export interface OscillatorEnergyState {
  t: number;
  x: number;
  v: number;
  kinetic: number;
  potential: number;
  total: number;
  /** kinetic / total ∈ [0, 1]; 0.5 when A = 0 is reported as 0. */
  kineticFraction: number;
}

export function calculateOscillatorEnergy(
  spring: SpringOscillator,
  solution: Omit<ShmSolution, 'omega'>,
  t: number,
): OscillatorEnergyState {
  const omega = shmAngularFrequency(spring);
  const state = calculateShmState({ omega, ...solution }, t);
  const kinetic = kineticEnergy(spring.m, state.v);
  const potential = springPotentialEnergy(spring.k, state.x);
  const total = totalOscillatorEnergy(spring.k, solution.amplitude);
  return {
    t,
    x: state.x,
    v: state.v,
    kinetic,
    potential,
    total,
    kineticFraction: total > 0 ? kinetic / total : 0,
  };
}

/**
 * Energy partition as a function of position (for E-vs-x graphs):
 *   U(x) = ½ k x²,  K(x) = E − U = ½ k (A² − x²).
 * |x| must not exceed A; beyond that the ideal model has no motion.
 */
export function energyAtPosition(
  k: number,
  amplitude: number,
  x: number,
): { potential: number; kinetic: number; total: number } {
  requirePositive('k', k);
  requireNonNegative('amplitude', amplitude);
  requireFinite('x', x);
  if (Math.abs(x) > amplitude * (1 + 1e-12)) {
    throw new RangeError(`|x| = ${Math.abs(x)} exceeds amplitude ${amplitude}; no ideal motion there.`);
  }
  const total = totalOscillatorEnergy(k, amplitude);
  const potential = springPotentialEnergy(k, x);
  return { potential, kinetic: Math.max(0, total - potential), total };
}
