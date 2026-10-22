import { describe, expect, it } from 'vitest';
import {
  classifyInterference,
  resultantAmplitude,
  superpose,
} from '../../physics/interference/superposition';
import {
  harmonicStandingParams,
  standingWaveAntinodes,
  standingWaveDisplacement,
  standingWaveNodes,
} from '../../physics/interference/standing';
import type { WaveComponent } from '../../physics/waves/travelling';

const comp = (over: Partial<WaveComponent> = {}): WaveComponent => ({
  amplitude: 0.05,
  waveNumber: Math.PI, // λ = 2 m
  angularFrequency: 10 * Math.PI, // f = 5 Hz
  phase: 0,
  direction: 1,
  ...over,
});

describe('superposition (§18.1)', () => {
  it('y_total is the sum of the components at every sample point', () => {
    const c1 = comp();
    const c2 = comp({ amplitude: 0.03, phase: Math.PI / 4 });
    for (let i = 0; i < 40; i++) {
      const x = i * 0.37;
      const t = i * 0.11;
      const y1 = c1.amplitude * Math.sin(c1.waveNumber * x - c1.angularFrequency * t + c1.phase);
      const y2 = c2.amplitude * Math.sin(c2.waveNumber * x - c2.angularFrequency * t + c2.phase);
      expect(superpose([c1, c2], x, t)).toBeCloseTo(y1 + y2, 12);
    }
  });

  it('in-phase equal waves give A_R = 2A (fully constructive)', () => {
    expect(resultantAmplitude(0.05, 0.05, 0)).toBeCloseTo(0.1, 12);
    expect(classifyInterference(0.05, 0.05, 0)).toBe('fully constructive');
    const c1 = comp();
    const c2 = comp();
    // Resultant must reach 2A somewhere: at the peak phase.
    const xPeak = Math.PI / 2 / Math.PI; // kx = π/2 at t = 0
    expect(superpose([c1, c2], xPeak, 0)).toBeCloseTo(0.1, 12);
  });

  it('opposite-phase equal waves cancel everywhere (fully destructive)', () => {
    expect(resultantAmplitude(0.05, 0.05, Math.PI)).toBeCloseTo(0, 9);
    expect(classifyInterference(0.05, 0.05, Math.PI)).toBe('fully destructive');
    const c1 = comp();
    const c2 = comp({ phase: Math.PI });
    for (const [x, t] of [[0.3, 0.2], [1.7, 0.9], [4.4, 2.1]] as const) {
      expect(superpose([c1, c2], x, t)).toBeCloseTo(0, 9);
    }
  });

  it('partial phase difference gives the phasor-sum amplitude', () => {
    // Δφ = π/2, A1 = 3, A2 = 4 ⇒ A_R = 5 (3-4-5 triangle of phasors)
    expect(resultantAmplitude(3, 4, Math.PI / 2)).toBeCloseTo(5, 10);
    expect(classifyInterference(3, 4, Math.PI / 2)).toBe('partial');
  });
});

describe('standing waves (§18.2)', () => {
  it('y = 2A sin(kx) cos(ωt) equals the sum of counter-propagating waves', () => {
    const A = 0.04;
    const k = 2;
    const w = 6;
    const right = comp({ amplitude: A, waveNumber: k, angularFrequency: w, direction: 1 });
    const left = comp({ amplitude: A, waveNumber: k, angularFrequency: w, direction: -1 });
    const params = { amplitude: A, waveNumber: k, angularFrequency: w };
    for (let i = 0; i < 50; i++) {
      const x = i * 0.23;
      const t = i * 0.13;
      expect(superpose([right, left], x, t)).toBeCloseTo(
        standingWaveDisplacement(params, x, t),
        10,
      );
    }
  });

  it('nodes stay at x = mπ/k for all times', () => {
    const k = Math.PI; // nodes at integer x
    const nodes = standingWaveNodes(k, 0, 4);
    expect(nodes.map((n) => Math.round(n))).toEqual([0, 1, 2, 3, 4]);
    const params = { amplitude: 0.05, waveNumber: k, angularFrequency: 7 };
    for (const x of nodes) {
      for (const t of [0, 0.31, 1.77]) {
        expect(standingWaveDisplacement(params, x, t)).toBeCloseTo(0, 12);
      }
    }
  });

  it('antinodes reach ±2A and sit midway between nodes', () => {
    const k = Math.PI;
    const params = { amplitude: 0.05, waveNumber: k, angularFrequency: 4 };
    const ant = standingWaveAntinodes(k, 0, 4);
    expect(ant.map((a) => Math.round(a * 2) / 2)).toEqual([0.5, 1.5, 2.5, 3.5]);
    // At cos(ωt) = 1 (t = 0) displacement equals +2A·sin(kx) = ±2A there.
    expect(Math.abs(standingWaveDisplacement(params, ant[0], 0))).toBeCloseTo(0.1, 12);
  });

  it('harmonic standing wave satisfies fixed-end boundary conditions', () => {
    const L = 3;
    const v = 90;
    const n = 4;
    const params = harmonicStandingParams(L, v, n, 0.02);
    expect(params.waveNumber).toBeCloseTo((n * Math.PI) / L, 12);
    expect(params.angularFrequency).toBeCloseTo((n * Math.PI * v) / L, 12);
    for (const t of [0, 0.2, 1.5]) {
      expect(standingWaveDisplacement(params, 0, t)).toBeCloseTo(0, 12);
      expect(standingWaveDisplacement(params, L, t)).toBeCloseTo(0, 12);
    }
    // Exactly n half-wavelengths fit: n + 1 nodes on [0, L].
    expect(standingWaveNodes(params.waveNumber, 0, L).length).toBe(n + 1);
  });
});
