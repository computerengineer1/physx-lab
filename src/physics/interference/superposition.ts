/**
 * Superposition of waves travelling in the same medium — PHYS220 §18.1.
 *
 *   y_total(x, t) = Σ_i y_i(x, t)
 *
 * For two sinusoids of the same k and ω with phase difference Δφ the
 * resultant amplitude is
 *   A_R = √(A1² + A2² + 2 A1 A2 cos Δφ)
 */

import { requireFinite, requireNonNegative } from '../shared/validation';
import { componentDisplacement, wavePhase } from '../waves/travelling';
import type { WaveComponent } from '../waves/travelling';

export type { WaveComponent };

export function superpose(components: readonly WaveComponent[], x: number, t: number): number {
  requireFinite('x', x);
  requireFinite('t', t);
  let sum = 0;
  for (const c of components) sum += componentDisplacement(c, x, t);
  return sum;
}

/** Resultant amplitude of two same-(k, ω) sinusoids with phase difference Δφ. */
export function resultantAmplitude(a1: number, a2: number, phaseDiff: number): number {
  requireNonNegative('A1', a1);
  requireNonNegative('A2', a2);
  requireFinite('Δφ', phaseDiff);
  const value = Math.sqrt(a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(phaseDiff));
  // Guard against tiny negative round-off inside sqrt.
  return Number.isFinite(value) ? value : Math.abs(a1 - a2);
}

export type InterferenceKind = 'fully constructive' | 'fully destructive' | 'partial';

export function classifyInterference(
  a1: number,
  a2: number,
  phaseDiff: number,
): InterferenceKind {
  const ar = resultantAmplitude(a1, a2, phaseDiff);
  const eps = 1e-9 * Math.max(1, a1 + a2);
  if (Math.abs(ar - (a1 + a2)) <= eps) return 'fully constructive';
  if (Math.abs(ar - Math.abs(a1 - a2)) <= eps) return 'fully destructive';
  return 'partial';
}

/** Phase of the resultant of two same-(k, ω) components (useful readout). */
export function resultantPhase(
  c1: WaveComponent,
  c2: WaveComponent,
  x: number,
  t: number,
): number {
  const p1 = wavePhase(c1, x, t);
  const p2 = wavePhase(c2, x, t);
  const y1 = c1.amplitude * Math.sin(p1);
  const y2 = c2.amplitude * Math.sin(p2);
  const s = c1.amplitude * Math.cos(p1) + c2.amplitude * Math.cos(p2);
  return Math.atan2(y1 + y2, s);
}
