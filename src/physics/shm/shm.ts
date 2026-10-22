/**
 * Simple Harmonic Motion — PHYS220 Chapter 15 (§15.1–§15.2).
 *
 * Model: ideal mass–spring system, no damping, no friction.
 *   m · d²x/dt² + k · x = 0     with F_spring = −k x
 *   ω = √(k/m),  T = 2π/ω = 2π √(m/k),  f = 1/T
 *   x(t) = A cos(ω t + φ)
 *   v(t) = −A ω sin(ω t + φ)
 *   a(t) = −ω² x(t)
 *
 * x is measured from the equilibrium position. For a vertical spring the
 * static stretch mg/k is absorbed into the equilibrium point, so the same
 * equations apply (standard treatment).
 *
 * All quantities are SI: k [N/m], m [kg], t [s], x [m], v [m/s], a [m/s²],
 * ω [rad/s], angles [rad].
 */

import { requirePositive, requireFinite } from '../shared/validation';

export interface SpringOscillator {
  /** Spring constant k [N/m], > 0. */
  k: number;
  /** Mass m [kg], > 0. */
  m: number;
}

/** x(t) = amplitude · cos(ω t + phase). */
export interface ShmSolution {
  omega: number;
  amplitude: number;
  phase: number;
}

export interface ShmState {
  t: number;
  x: number;
  v: number;
  a: number;
  /** Normalized phase (ω t + φ) mod 2π, in [0, 2π). */
  theta: number;
}

export function shmAngularFrequency({ k, m }: SpringOscillator): number {
  requirePositive('k', k);
  requirePositive('m', m);
  return Math.sqrt(k / m);
}

export function shmPeriod({ k, m }: SpringOscillator): number {
  return (2 * Math.PI) / shmAngularFrequency({ k, m });
}

export function shmFrequency({ k, m }: SpringOscillator): number {
  return 1 / shmPeriod({ k, m });
}

/**
 * Derive a coherent (A, φ) pair from initial conditions x(0) = x0 and
 * v(0) = v0 so the user's initial state is preserved exactly:
 *   A = √(x0² + (v0/ω)²),   φ = atan2(−v0/ω, x0)
 * Special case x0 = v0 = 0 ⇒ A = 0, φ = 0 (mass at rest at equilibrium).
 */
export function solutionFromInitialConditions(
  x0: number,
  v0: number,
  omega: number,
): { amplitude: number; phase: number } {
  requireFinite('x0', x0);
  requireFinite('v0', v0);
  requirePositive('omega', omega);
  const amplitude = Math.hypot(x0, v0 / omega);
  if (amplitude === 0) return { amplitude: 0, phase: 0 };
  const phase = Math.atan2(-v0 / omega, x0);
  return { amplitude, phase };
}

export function calculateShmState(solution: ShmSolution, t: number): ShmState {
  const { omega, amplitude, phase } = solution;
  requireFinite('omega', omega);
  requireFinite('amplitude', amplitude);
  requireFinite('phase', phase);
  requireFinite('t', t);
  const thetaRaw = omega * t + phase;
  const theta = ((thetaRaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const x = amplitude * Math.cos(thetaRaw);
  const v = -amplitude * omega * Math.sin(thetaRaw);
  const a = -omega * omega * x;
  return { t, x, v, a, theta };
}

/** Convenience: full state of a spring oscillator started from (x0, v0). */
export function calculateSpringState(
  spring: SpringOscillator,
  x0: number,
  v0: number,
  t: number,
): ShmState {
  const omega = shmAngularFrequency(spring);
  const { amplitude, phase } = solutionFromInitialConditions(x0, v0, omega);
  return calculateShmState({ omega, amplitude, phase }, t);
}

/** Spring force F = −k x [N]. */
export function springForce(k: number, x: number): number {
  requirePositive('k', k);
  requireFinite('x', x);
  return -k * x;
}

/**
 * Classify the phase position of the oscillator for teaching markers.
 * Uses the normalized phase θ of x = A cos θ.
 */
export function shmPhaseMarker(state: ShmState): {
  label: 'turning point (+A)' | 'equilibrium (moving −)' | 'turning point (−A)' | 'equilibrium (moving +)' | 'other';
  atTurningPoint: boolean;
  atEquilibrium: boolean;
} {
  const eps = 1e-6;
  const theta = state.theta;
  const near = (target: number) => {
    const d = Math.abs(((theta - target + Math.PI) % (2 * Math.PI)) - Math.PI);
    return d < eps;
  };
  if (near(0)) return { label: 'turning point (+A)', atTurningPoint: true, atEquilibrium: false };
  if (near(Math.PI)) return { label: 'turning point (−A)', atTurningPoint: true, atEquilibrium: false };
  if (near(Math.PI / 2))
    return { label: 'equilibrium (moving −)', atTurningPoint: false, atEquilibrium: true };
  if (near((3 * Math.PI) / 2))
    return { label: 'equilibrium (moving +)', atTurningPoint: false, atEquilibrium: true };
  return { label: 'other', atTurningPoint: false, atEquilibrium: false };
}
