import { describe, expect, it } from 'vitest';
import {
  angularFrequency,
  pulseDisplacement,
  toComponent,
  travellingWaveDisplacement,
  travellingWaveTransverseVelocity,
  waveNumber,
  waveSpeedFromFrequencyAndWavelength,
  wavelengthFromSpeedAndFrequency,
} from '../../physics/waves/travelling';
import type { TravellingWaveParams } from '../../physics/waves/travelling';

const base: TravellingWaveParams = {
  amplitude: 0.04,
  wavelength: 2,
  frequency: 5,
  phase: 0,
  direction: 1,
};

describe('wave relations', () => {
  it('k = 2π/λ and ω = 2πf', () => {
    expect(waveNumber(2)).toBeCloseTo(Math.PI, 12);
    expect(angularFrequency(5)).toBeCloseTo(10 * Math.PI, 12);
  });

  it('v = fλ and λ = v/f are consistent', () => {
    expect(waveSpeedFromFrequencyAndWavelength(5, 2)).toBeCloseTo(10, 12);
    expect(wavelengthFromSpeedAndFrequency(10, 5)).toBeCloseTo(2, 12);
  });

  it('rejects invalid inputs', () => {
    expect(() => waveNumber(0)).toThrow();
    expect(() => waveNumber(-1)).toThrow();
    expect(() => angularFrequency(-2)).toThrow();
    expect(() => wavelengthFromSpeedAndFrequency(0, 5)).toThrow();
  });
});

describe('travelling wave y = A sin(kx − ωt + φ)', () => {
  it('profile translates at v without distortion (+x direction)', () => {
    const v = waveSpeedFromFrequencyAndWavelength(base.frequency, base.wavelength); // 10 m/s
    for (const t of [0, 0.07, 0.31, 1.2]) {
      for (const x of [-3, 0, 1.7, 8.4]) {
        const early = travellingWaveDisplacement(base, x, 0);
        const later = travellingWaveDisplacement(base, x + v * t, t);
        expect(later).toBeCloseTo(early, 9);
      }
    }
  });

  it('−x direction: profile translates toward −x', () => {
    const back: TravellingWaveParams = { ...base, direction: -1 };
    const v = 10; // fλ
    const t = 0.23;
    for (const x of [0, 2.5, -4]) {
      expect(travellingWaveDisplacement(back, x, t)).toBeCloseTo(
        travellingWaveDisplacement(back, x + v * t, 0),
        9,
      );
    }
  });

  it('peak position moves at v', () => {
    // At t = 0 with φ = 0, a peak (sin = 1) sits at kx = π/2 ⇒ x = λ/4.
    const k = waveNumber(base.wavelength);
    const xPeak0 = Math.PI / 2 / k; // = 0.5 m
    expect(travellingWaveDisplacement(base, xPeak0, 0)).toBeCloseTo(base.amplitude, 12);
    const v = 10;
    const t = 0.15;
    expect(travellingWaveDisplacement(base, xPeak0 + v * t, t)).toBeCloseTo(base.amplitude, 9);
  });

  it('transverse velocity is ∂y/∂t (finite-difference cross-check)', () => {
    const h = 1e-6;
    const x = 1.23;
    const t = 0.77;
    const numeric =
      (travellingWaveDisplacement(base, x, t + h) - travellingWaveDisplacement(base, x, t - h)) /
      (2 * h);
    expect(travellingWaveTransverseVelocity(base, x, t)).toBeCloseTo(numeric, 6);
  });

  it('phase shift: y at φ equals y at t − φ/ω with φ = 0', () => {
    const shifted: TravellingWaveParams = { ...base, phase: Math.PI / 3 };
    const omega = angularFrequency(base.frequency);
    const t = 0.4;
    const x = 3.3;
    expect(travellingWaveDisplacement(shifted, x, t)).toBeCloseTo(
      travellingWaveDisplacement(base, x, t - Math.PI / 3 / omega),
      9,
    );
  });
});

describe('gaussian pulse (§16.1)', () => {
  it('travels rigidly at the given speed', () => {
    const v = 6;
    const t = 0.5;
    for (const x of [0, 1, 4, 9]) {
      expect(pulseDisplacement(0.1, 2, v, 0.3, 1, x + v * t, t)).toBeCloseTo(
        pulseDisplacement(0.1, 2, v, 0.3, 1, x, 0),
        12,
      );
    }
  });

  it('peak amplitude at the pulse centre', () => {
    expect(pulseDisplacement(0.1, 2, 6, 0.3, 1, 2 + 6 * 0.25, 0.25)).toBeCloseTo(0.1, 12);
  });
});

describe('component conversion', () => {
  it('toComponent preserves the displacement', () => {
    const c = toComponent(base);
    expect(c.waveNumber).toBeCloseTo(Math.PI, 12);
    expect(c.angularFrequency).toBeCloseTo(10 * Math.PI, 12);
    expect(travellingWaveDisplacement(base, 2.7, 0.9)).toBeCloseTo(
      c.amplitude * Math.sin(c.waveNumber * 2.7 - c.angularFrequency * 0.9 + c.phase),
      12,
    );
  });
});
