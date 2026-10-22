import { describe, expect, it } from 'vitest';
import {
  averageWavePower,
  fixedEndAntinodePositions,
  fixedEndNodePositions,
  fundamentalFrequency,
  harmonicFrequency,
  harmonicWavelength,
  nearestHarmonic,
  stringWaveSpeed,
} from '../../physics/waves/string';
import { PhysicsInputError } from '../../physics/shared/validation';

describe('string wave speed v = √(Tₛ/μ)', () => {
  it('computes the ideal speed', () => {
    // Tₛ = 100 N, μ = 0.01 kg/m ⇒ v = √10000 = 100 m/s
    expect(stringWaveSpeed(100, 0.01)).toBeCloseTo(100, 10);
  });

  it('quadrupling the tension doubles the speed; quadrupling μ halves it', () => {
    const v = stringWaveSpeed(50, 0.02);
    expect(stringWaveSpeed(200, 0.02) / v).toBeCloseTo(2, 10);
    expect(stringWaveSpeed(50, 0.08) / v).toBeCloseTo(0.5, 10);
  });

  it('rejects non-positive or non-finite inputs', () => {
    expect(() => stringWaveSpeed(0, 0.01)).toThrow(PhysicsInputError);
    expect(() => stringWaveSpeed(10, -1)).toThrow(PhysicsInputError);
    expect(() => stringWaveSpeed(Infinity, 1)).toThrow(PhysicsInputError);
  });
});

describe('average power P = ½ μ ω² A² v', () => {
  it('matches a hand-computed reference', () => {
    // μ = 0.01, ω = 10, A = 0.05, v = 100 ⇒ P = ½·0.01·100·0.0025·100 = 0.125 W
    expect(
      averageWavePower({ linearDensity: 0.01, angularFrequency: 10, amplitude: 0.05, speed: 100 }),
    ).toBeCloseTo(0.125, 12);
  });

  it('scales as A² and ω²', () => {
    const base = { linearDensity: 0.02, angularFrequency: 8, amplitude: 0.03, speed: 60 };
    const p = averageWavePower(base);
    expect(averageWavePower({ ...base, amplitude: 0.06 }) / p).toBeCloseTo(4, 10);
    expect(averageWavePower({ ...base, angularFrequency: 16 }) / p).toBeCloseTo(4, 10);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      averageWavePower({ linearDensity: 0, angularFrequency: 8, amplitude: 0.03, speed: 60 }),
    ).toThrow(PhysicsInputError);
  });
});

describe('harmonics of a string fixed at both ends', () => {
  const L = 2; // m
  const v = 100; // m/s

  it('λ_n = 2L/n', () => {
    expect(harmonicWavelength(L, 1)).toBeCloseTo(4, 12);
    expect(harmonicWavelength(L, 2)).toBeCloseTo(2, 12);
    expect(harmonicWavelength(L, 3)).toBeCloseTo(4 / 3, 12);
  });

  it('f_n = n v/(2L)', () => {
    expect(fundamentalFrequency(L, v)).toBeCloseTo(25, 12);
    expect(harmonicFrequency(L, v, 3)).toBeCloseTo(75, 12);
    expect(harmonicFrequency(L, v, 4)).toBeCloseTo(100, 12);
  });

  it('rejects non-integer / non-positive n', () => {
    expect(() => harmonicFrequency(L, v, 1.5)).toThrow(PhysicsInputError);
    expect(() => harmonicFrequency(L, v, 0)).toThrow(PhysicsInputError);
  });

  it('node and antinode positions are correct', () => {
    const nodes = fixedEndNodePositions(L, 3);
    expect(nodes.length).toBe(4); // n + 1 nodes (endpoints included)
    nodes.forEach((x, i) => expect(x).toBeCloseTo((i * L) / 3, 12));
    const ant = fixedEndAntinodePositions(L, 3);
    expect(ant.length).toBe(3);
    expect(ant[0]).toBeCloseTo(1 / 3, 12);
    expect(ant[1]).toBeCloseTo(1, 12);
    expect(ant[2]).toBeCloseTo(5 / 3, 12);
  });

  it('nearestHarmonic rounds to the closest mode', () => {
    expect(nearestHarmonic(L, v, 26)).toBe(1);
    expect(nearestHarmonic(L, v, 74)).toBe(3);
    expect(nearestHarmonic(L, v, 126)).toBe(5);
  });
});
