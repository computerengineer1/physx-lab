import { describe, expect, it } from 'vitest';
import { generateQuestion } from '../../education/questions';
import { MODULES } from '../../app/course';
import { shmPeriod } from '../../physics/shm/shm';
import { stringWaveSpeed } from '../../physics/waves/string';
import { criticalAngle, radToDeg } from '../../physics/optics/rays';

const PRACTICE_MODULES = ['oscillatory-motion', 'wave-motion', 'interference', 'ray-optics', 'image-formation'];

/** Structural invariants every generated question must satisfy. */
describe('practice question generators', () => {
  for (const moduleId of PRACTICE_MODULES) {
    it(`${moduleId}: 80 randomized draws are structurally valid`, () => {
      const validTabs = (MODULES.find((m) => m.id === moduleId)?.sections ?? []).map((s) => s.path);
      for (let i = 0; i < 80; i++) {
        const q = generateQuestion(moduleId);
        expect(q.prompt.length).toBeGreaterThan(20);
        expect(q.steps.length).toBeGreaterThanOrEqual(3);
        if (q.kind === 'numeric') {
          expect(Number.isFinite(q.answer)).toBe(true);
          expect(typeof q.unit).toBe('string');
          expect(q.tolerancePct).toBeGreaterThanOrEqual(0);
        } else {
          expect(q.options!.length).toBeGreaterThanOrEqual(2);
          expect(q.correctIndex!).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex!).toBeLessThan(q.options!.length);
          // The correct option must not be textually duplicated among distractors.
          const correctText = q.options![q.correctIndex!];
          expect(q.options!.filter((o) => o === correctText)).toHaveLength(1);
        }
        if (q.simTarget) expect(validTabs).toContain(q.simTarget);
        if (q.simParams) {
          for (const v of Object.values(q.simParams)) {
            if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    });
  }

  it('numeric answers stay inside physically valid ranges (spot invariants)', () => {
    for (let i = 0; i < 120; i++) {
      const q = generateQuestion('ray-optics');
      if (q.id.startsWith('critA')) {
        // critical angles lie strictly between 0 and 90 degrees
        expect(q.answer!).toBeGreaterThan(0);
        expect(q.answer!).toBeLessThan(90);
      }
      if (q.id.startsWith('snell')) {
        expect(q.answer!).toBeGreaterThanOrEqual(0);
        expect(q.answer!).toBeLessThan(90);
        // generator must never produce a TIR case (θ₂ must exist)
        expect(Number.isFinite(q.answer)).toBe(true);
      }
    }
    for (let i = 0; i < 120; i++) {
      const q = generateQuestion('image-formation');
      if (q.id.startsWith('mirD')) {
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer!).not.toBe(0);
      }
    }
  });

  it('answers are computed by the physics core, not hardcoded (deterministic spot check)', () => {
    // Force deterministic draws by stubbing Math.random.
    const orig = Math.random;
    try {
      Math.random = () => 0;
      // oscillatory-motion pool[0] = qShmPeriod with m = 0.2, k = 5
      const q1 = generateQuestion('oscillatory-motion');
      expect(q1.kind).toBe('numeric');
      expect(q1.answer!).toBeCloseTo(shmPeriod({ k: 5, m: 0.2 }), 9);
      // wave-motion pool[0] = qStringSpeed with tension = 20, mu = 0.002
      const q2 = generateQuestion('wave-motion');
      expect(q2.kind).toBe('numeric');
      expect(q2.answer!).toBeCloseTo(stringWaveSpeed(20, 0.002), 9);

      // ray-optics pool[2] = qLightSpeed with n = 1.8 (r2(1.2, 2.4) at rnd=0.5)
      Math.random = () => 0.5;
      const q3 = generateQuestion('ray-optics');
      expect(q3.id.startsWith('cmed')).toBe(true);
      // independently: v = c/n with c = 2.99792458e8 m/s
      expect(q3.answer!).toBeCloseTo(2.99792458 / 1.8, 6);
    } finally {
      Math.random = orig;
    }
  });

  it('critical-angle questions respect the n₁ > n₂ condition', () => {
    for (let i = 0; i < 60; i++) {
      const q = generateQuestion('ray-optics');
      if (!q.id.startsWith('critA')) continue;
      const n1 = q.simParams!.n1 as number;
      const n2 = q.simParams!.n2 as number;
      expect(n1).toBeGreaterThan(n2);
      expect(q.answer!).toBeCloseTo(radToDeg(criticalAngle(n1, n2)!), 6);
    }
  });

  it('THROWs (never fabricates) for unknown modules', () => {
    expect(() => generateQuestion('nonexistent-module')).toThrow(/No question generators/);
  });
});
