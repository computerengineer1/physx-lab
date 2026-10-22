import { describe, expect, it } from 'vitest';
import {
  calculateOscillatorEnergy,
  energyAtPosition,
  kineticEnergy,
  springPotentialEnergy,
  totalOscillatorEnergy,
} from '../../physics/shm/energy';

describe('oscillator energy', () => {
  it('basic values: K = ½mv², U = ½kx², E = ½kA²', () => {
    expect(kineticEnergy(2, 3)).toBeCloseTo(9, 12); // ½·2·9
    expect(springPotentialEnergy(50, 0.2)).toBeCloseTo(1, 12); // ½·50·0.04
    expect(totalOscillatorEnergy(50, 0.2)).toBeCloseTo(1, 12);
  });

  it('total energy is conserved over a full period (ideal model)', () => {
    const spring = { k: 40, m: 0.5 };
    const sol = { amplitude: 0.15, phase: 0.7 };
    const E0 = totalOscillatorEnergy(spring.k, sol.amplitude); // ½·40·0.0225 = 0.45 J
    expect(E0).toBeCloseTo(0.45, 12);
    const T = 2 * Math.PI * Math.sqrt(spring.m / spring.k);
    for (let i = 0; i <= 200; i++) {
      const e = calculateOscillatorEnergy(spring, sol, (i / 200) * T);
      expect(e.kinetic + e.potential).toBeCloseTo(E0, 10);
      expect(e.total).toBeCloseTo(E0, 12);
      expect(e.kinetic).toBeGreaterThanOrEqual(0);
      expect(e.potential).toBeGreaterThanOrEqual(0);
    }
  });

  it('at turning points all energy is potential; at equilibrium all kinetic', () => {
    const spring = { k: 20, m: 2 };
    const A = 0.1;
    const atTurn = calculateOscillatorEnergy(spring, { amplitude: A, phase: 0 }, 0);
    expect(atTurn.potential).toBeCloseTo(0.5 * 20 * 0.01, 12);
    expect(atTurn.kinetic).toBeCloseTo(0, 12);

    const omega = Math.sqrt(10);
    const atEq = calculateOscillatorEnergy(
      spring,
      { amplitude: A, phase: 0 },
      Math.PI / 2 / omega,
    );
    expect(atEq.potential).toBeCloseTo(0, 9);
    expect(atEq.kinetic).toBeCloseTo(0.5 * 20 * 0.01, 9);
  });

  it('doubling the amplitude quadruples the total energy', () => {
    const E1 = totalOscillatorEnergy(30, 0.05);
    const E2 = totalOscillatorEnergy(30, 0.1);
    expect(E2 / E1).toBeCloseTo(4, 12);
  });

  it('energy vs position: K = E − U and rejects |x| > A', () => {
    const e = energyAtPosition(50, 0.2, 0.1);
    expect(e.potential).toBeCloseTo(0.5 * 50 * 0.01, 12);
    expect(e.kinetic).toBeCloseTo(e.total - e.potential, 12);
    expect(() => energyAtPosition(50, 0.2, 0.25)).toThrow(RangeError);
  });
});
