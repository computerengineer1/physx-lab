import { describe, expect, it } from 'vitest';
import {
  C_VACUUM,
  criticalAngle,
  degToRad,
  lightSpeedInMedium,
  radToDeg,
  refract,
  reflectionAngle,
} from '../../physics/optics/rays';
import { PhysicsInputError } from '../../physics/shared/validation';

describe('reflection (§35.4)', () => {
  it('θ_r = θ_i measured from the normal', () => {
    expect(reflectionAngle(degToRad(30))).toBeCloseTo(degToRad(30), 12);
    expect(radToDeg(reflectionAngle(degToRad(72.5)))).toBeCloseTo(72.5, 10);
    expect(reflectionAngle(0)).toBe(0);
  });

  it('rejects angles ≥ 90° and negative angles', () => {
    expect(() => reflectionAngle(degToRad(90))).toThrow(PhysicsInputError);
    expect(() => reflectionAngle(-0.1)).toThrow(PhysicsInputError);
  });
});

describe('refraction (§35.5)', () => {
  it('Snell’s law: air→glass at 30° gives θ₂ = arcsin(1/3) ≈ 19.471°', () => {
    const r = refract(1, 1.5, degToRad(30));
    expect(r.refracted).toBe(true);
    expect(r.totalInternalReflection).toBe(false);
    expect(radToDeg(r.theta2 as number)).toBeCloseTo(19.4712, 3);
    // Cross-check with Snell: n1 sinθ1 = n2 sinθ2
    expect(1.5 * Math.sin(r.theta2 as number)).toBeCloseTo(Math.sin(degToRad(30)), 12);
  });

  it('bends away from the normal when entering a rarer medium', () => {
    const r = refract(1.5, 1, degToRad(30));
    expect(radToDeg(r.theta2 as number)).toBeCloseTo(48.5904, 3); // arcsin(0.75)
    expect((r.theta2 as number) > degToRad(30)).toBe(true);
  });

  it('normal incidence passes straight through', () => {
    const r = refract(1, 1.5, 0);
    expect(r.theta2).toBeCloseTo(0, 12);
  });

  it('n = c/v: light speed in a medium', () => {
    expect(lightSpeedInMedium(1)).toBe(C_VACUUM);
    expect(lightSpeedInMedium(1.5)).toBeCloseTo(C_VACUUM / 1.5, 3);
    expect(() => lightSpeedInMedium(0)).toThrow(PhysicsInputError);
  });
});

describe('total internal reflection (§35.8)', () => {
  it('critical angle glass→air: θ_c = arcsin(1/1.5) ≈ 41.810°', () => {
    const tc = criticalAngle(1.5, 1);
    expect(tc).not.toBeNull();
    expect(radToDeg(tc as number)).toBeCloseTo(41.8103, 3);
  });

  it('no critical angle when n₁ ≤ n₂', () => {
    expect(criticalAngle(1, 1.5)).toBeNull();
    expect(criticalAngle(1.5, 1.5)).toBeNull();
  });

  it('TIR occurs only above θ_c and only when n₁ > n₂', () => {
    const tc = criticalAngle(1.5, 1) as number;
    const below = refract(1.5, 1, tc - degToRad(5));
    expect(below.refracted).toBe(true);
    expect(below.totalInternalReflection).toBe(false);

    const above = refract(1.5, 1, tc + degToRad(5));
    expect(above.refracted).toBe(false);
    expect(above.theta2).toBeNull();
    expect(above.totalInternalReflection).toBe(true);
    expect(above.reflected).toBe(true);

    // Into a denser medium, TIR can never happen even at grazing incidence.
    const dense = refract(1, 1.5, degToRad(89));
    expect(dense.totalInternalReflection).toBe(false);
    expect(dense.refracted).toBe(true);
  });

  it('at exactly θ_c the refracted ray grazes the surface (θ₂ = 90°)', () => {
    const tc = criticalAngle(1.5, 1) as number;
    const at = refract(1.5, 1, tc);
    expect(at.atCriticalAngle).toBe(true);
    expect(at.theta2).toBeCloseTo(Math.PI / 2, 9);
    expect(at.totalInternalReflection).toBe(false);
  });

  it('rejects invalid inputs', () => {
    expect(() => refract(-1, 1.5, 0.2)).toThrow(PhysicsInputError);
    expect(() => refract(1, 1.5, degToRad(90))).toThrow(PhysicsInputError);
    expect(() => criticalAngle(1.5, NaN as number)).toThrow(PhysicsInputError);
  });
});
