/**
 * Travelling sinusoidal waves — PHYS220 Chapter 16 (§16.1–§16.2).
 *
 *   y(x, t) = A sin(k x − ω t + φ)        (propagation in +x)
 *   y(x, t) = A sin(k x + ω t + φ)        (propagation in −x)
 *   k = 2π/λ,  ω = 2π f,  v = ω/k = f λ
 *
 * y is the transverse displacement of the medium at position x — medium
 * particles oscillate locally; the disturbance propagates at v.
 *
 * SI units: A [m], λ [m], f [Hz], ω [rad/s], k [rad/m], v [m/s], t [s].
 */

import { requireFinite, requirePositive } from '../shared/validation';

export type WaveDirection = 1 | -1;

/** A wave expressed in (k, ω) form — the shared component type used by
 * the superposition and standing-wave modules too (single source of truth). */
export interface WaveComponent {
  amplitude: number;
  waveNumber: number;
  angularFrequency: number;
  phase: number;
  direction: WaveDirection;
}

export interface TravellingWaveParams {
  /** Transverse amplitude A [m]. */
  amplitude: number;
  /** Wavelength λ [m]. */
  wavelength: number;
  /** Frequency f [Hz]. */
  frequency: number;
  /** Initial phase φ [rad]. */
  phase: number;
  /** +1: travels toward +x; −1: travels toward −x. */
  direction: WaveDirection;
}

export function waveNumber(wavelength: number): number {
  requirePositive('wavelength', wavelength);
  return (2 * Math.PI) / wavelength;
}

export function angularFrequency(frequency: number): number {
  requireFinite('frequency', frequency);
  if (frequency < 0) {
    throw new Error(`frequency must be ≥ 0 (received ${frequency}).`);
  }
  return 2 * Math.PI * frequency;
}

/** v = f λ = ω / k. */
export function waveSpeedFromFrequencyAndWavelength(
  frequency: number,
  wavelength: number,
): number {
  requireFinite('frequency', frequency);
  requirePositive('wavelength', wavelength);
  if (frequency < 0) throw new Error(`frequency must be ≥ 0 (received ${frequency}).`);
  return frequency * wavelength;
}

export function wavelengthFromSpeedAndFrequency(speed: number, frequency: number): number {
  requirePositive('speed', speed);
  requirePositive('frequency', frequency);
  return speed / frequency;
}

export function frequencyFromSpeedAndWavelength(speed: number, wavelength: number): number {
  requirePositive('speed', speed);
  requirePositive('wavelength', wavelength);
  return speed / wavelength;
}

export function toComponent(params: TravellingWaveParams): WaveComponent {
  return {
    amplitude: params.amplitude,
    waveNumber: waveNumber(params.wavelength),
    angularFrequency: angularFrequency(params.frequency),
    phase: params.phase,
    direction: params.direction,
  };
}

/** Phase argument kx − dir·ωt + φ (unwrapped). */
export function wavePhase(w: WaveComponent, x: number, t: number): number {
  requireFinite('x', x);
  requireFinite('t', t);
  return w.waveNumber * x - w.direction * w.angularFrequency * t + w.phase;
}

export function componentDisplacement(w: WaveComponent, x: number, t: number): number {
  return w.amplitude * Math.sin(wavePhase(w, x, t));
}

export function travellingWaveDisplacement(
  params: TravellingWaveParams,
  x: number,
  t: number,
): number {
  return componentDisplacement(toComponent(params), x, t);
}

/** Transverse particle velocity ∂y/∂t = −dir·A ω cos(kx − dir·ωt + φ). */
export function componentTransverseVelocity(w: WaveComponent, x: number, t: number): number {
  return -w.direction * w.amplitude * w.angularFrequency * Math.cos(wavePhase(w, x, t));
}

export function travellingWaveTransverseVelocity(
  params: TravellingWaveParams,
  x: number,
  t: number,
): number {
  return componentTransverseVelocity(toComponent(params), x, t);
}

/**
 * §16.1 Gaussian pulse used to visualize "propagation of a disturbance":
 * a localized bump travelling at constant speed without changing shape.
 *   y(x,t) = A exp( −(x − x0 − dir·v·t)² / (2 σ²) )
 */
export function pulseDisplacement(
  amplitude: number,
  pulseCenter0: number,
  speed: number,
  sigma: number,
  direction: WaveDirection,
  x: number,
  t: number,
): number {
  requireFinite('amplitude', amplitude);
  requireFinite('pulseCenter0', pulseCenter0);
  requireFinite('speed', speed);
  requirePositive('sigma', sigma);
  requireFinite('x', x);
  requireFinite('t', t);
  const d = x - pulseCenter0 - direction * speed * t;
  return amplitude * Math.exp(-(d * d) / (2 * sigma * sigma));
}

/** Sample a spatial profile y(x) over [x0, x1]. */
export function sampleSpatial(
  fn: (x: number) => number,
  x0: number,
  x1: number,
  samples: number,
): Float64Array {
  const n = Math.max(2, Math.floor(samples));
  const out = new Float64Array(2 * n);
  const dx = (x1 - x0) / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx;
    out[2 * i] = x;
    out[2 * i + 1] = fn(x);
  }
  return out;
}

/** Sample a time history y(t) at fixed x over [0, tEnd]. */
export function sampleTemporal(
  fn: (t: number) => number,
  tEnd: number,
  samples: number,
): Float64Array {
  return sampleSpatial(fn, 0, tEnd, samples);
}
