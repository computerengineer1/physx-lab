import { describe, expect, it } from 'vitest';
import {
  calculateShmState,
  calculateSpringState,
  shmAngularFrequency,
  shmFrequency,
  shmPeriod,
  solutionFromInitialConditions,
  springForce,
} from '../../physics/shm/shm';
import { PhysicsInputError } from '../../physics/shared/validation';

// Independent reference values, hand-computed:
// k = 25 N/m, m = 1 kg  ⇒  ω = √25 = 5 rad/s, T = 2π/5 ≈ 1.256637 s,
// f = 5/(2π) ≈ 0.795775 Hz.

describe('SHM frequency relations', () => {
  it('computes ω = √(k/m)', () => {
    expect(shmAngularFrequency({ k: 25, m: 1 })).toBeCloseTo(5, 12);
    expect(shmAngularFrequency({ k: 100, m: 4 })).toBeCloseTo(5, 12);
  });

  it('computes T = 2π√(m/k) and f = 1/T', () => {
    const T = shmPeriod({ k: 25, m: 1 });
    expect(T).toBeCloseTo((2 * Math.PI) / 5, 12);
    expect(shmFrequency({ k: 25, m: 1 })).toBeCloseTo(5 / (2 * Math.PI), 12);
    expect(shmFrequency({ k: 25, m: 1 }) * T).toBeCloseTo(1, 12);
  });

  it('doubling the mass multiplies the period by √2', () => {
    const T1 = shmPeriod({ k: 12, m: 3 });
    const T2 = shmPeriod({ k: 12, m: 6 });
    expect(T2 / T1).toBeCloseTo(Math.SQRT2, 12);
  });

  it('rejects non-physical inputs', () => {
    expect(() => shmAngularFrequency({ k: -1, m: 2 })).toThrow(PhysicsInputError);
    expect(() => shmAngularFrequency({ k: 0, m: 2 })).toThrow(PhysicsInputError);
    expect(() => shmAngularFrequency({ k: 5, m: NaN })).toThrow(PhysicsInputError);
  });
});

describe('SHM state x(t) = A cos(ωt + φ)', () => {
  it('matches analytic values at quarter periods (φ = 0)', () => {
    const sol = { omega: 5, amplitude: 0.2, phase: 0 };
    const s0 = calculateShmState(sol, 0);
    expect(s0.x).toBeCloseTo(0.2, 12);
    expect(s0.v).toBeCloseTo(0, 12);
    expect(s0.a).toBeCloseTo(-25 * 0.2, 12); // a = −ω²x

    const sq = calculateShmState(sol, Math.PI / 10); // ωt = π/2
    expect(sq.x).toBeCloseTo(0, 9);
    expect(sq.v).toBeCloseTo(-0.2 * 5, 9); // v = −Aω at equilibrium
    expect(sq.a).toBeCloseTo(0, 9);

    const half = calculateShmState(sol, Math.PI / 5); // ωt = π
    expect(half.x).toBeCloseTo(-0.2, 9);
    expect(half.v).toBeCloseTo(0, 9);
  });

  it('acceleration always satisfies a = −ω²x', () => {
    const sol = { omega: 3.7, amplitude: 0.13, phase: 1.1 };
    for (let i = 0; i < 50; i++) {
      const s = calculateShmState(sol, i * 0.037);
      expect(s.a).toBeCloseTo(-(sol.omega ** 2) * s.x, 10);
    }
  });

  it('spring force obeys F = −kx', () => {
    expect(springForce(25, 0.2)).toBeCloseTo(-5, 12);
    expect(springForce(25, -0.2)).toBeCloseTo(5, 12);
  });
});

describe('initial conditions', () => {
  it('reproduces the specified x(0), v(0) exactly', () => {
    const omega = 4;
    for (const [x0, v0] of [
      [0.3, 0],
      [0, 1.2],
      [0.15, -0.8],
      [-0.2, 0.5],
    ] as const) {
      const { amplitude, phase } = solutionFromInitialConditions(x0, v0, omega);
      const s = calculateShmState({ omega, amplitude, phase }, 0);
      expect(s.x).toBeCloseTo(x0, 12);
      expect(s.v).toBeCloseTo(v0, 12);
      // Energy route: A² = x0² + (v0/ω)²
      expect(amplitude).toBeCloseTo(Math.hypot(x0, v0 / omega), 12);
    }
  });

  it('handles the trivial rest state', () => {
    const { amplitude, phase } = solutionFromInitialConditions(0, 0, 5);
    expect(amplitude).toBe(0);
    expect(phase).toBe(0);
  });

  it('calculateSpringState agrees with the two-step route', () => {
    const direct = calculateSpringState({ k: 36, m: 4 }, 0.1, -0.6, 1.3);
    const omega = 3; // √(36/4)
    const { amplitude, phase } = solutionFromInitialConditions(0.1, -0.6, omega);
    const indirect = calculateShmState({ omega, amplitude, phase }, 1.3);
    expect(direct.x).toBeCloseTo(indirect.x, 12);
    expect(direct.v).toBeCloseTo(indirect.v, 12);
  });
});
