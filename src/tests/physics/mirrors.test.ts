import { describe, expect, it } from 'vitest';
import { calculateFlatMirrorImage } from '../../physics/mirrors/flat';
import {
  calculateSphericalMirrorImage,
  concaveObjectZone,
  describeSphericalMirrorImage,
  focalLengthFromRadius,
  radiusFromFocalLength,
} from '../../physics/mirrors/spherical';
import { PhysicsInputError } from '../../physics/shared/validation';

describe('flat mirrors (§36.1)', () => {
  it('d_i = −d_o and m = +1', () => {
    const img = calculateFlatMirrorImage(2, 0.5);
    expect(img.imageDistance).toBeCloseTo(-2, 12);
    expect(img.magnification).toBe(1);
    expect(img.imageHeight).toBeCloseTo(0.5, 12);
    expect(img.virtual).toBe(true);
    expect(img.upright).toBe(true);
  });

  it('image distance tracks the object distance', () => {
    for (const d of [0.25, 1, 3.7]) {
      expect(calculateFlatMirrorImage(d, 1).imageDistance).toBeCloseTo(-d, 12);
    }
  });

  it('rejects a non-positive object distance', () => {
    expect(() => calculateFlatMirrorImage(0, 0.5)).toThrow(PhysicsInputError);
    expect(() => calculateFlatMirrorImage(-1, 0.5)).toThrow(PhysicsInputError);
  });
});

describe('spherical mirrors (§36.2)', () => {
  it('f = ±R/2 by mirror type', () => {
    expect(focalLengthFromRadius(0.4, 'concave')).toBeCloseTo(0.2, 12);
    expect(focalLengthFromRadius(0.4, 'convex')).toBeCloseTo(-0.2, 12);
    expect(radiusFromFocalLength(-0.2)).toBeCloseTo(0.4, 12);
  });

  describe('concave, f = +0.10 m, h_o = 0.02 m', () => {
    const f = 0.1;

    it('object beyond C (d_o = 0.30): real, inverted, reduced; d_i = 0.15, m = −0.5', () => {
      const img = calculateSphericalMirrorImage(f, 0.3, 0.02);
      expect(img.atInfinity).toBe(false);
      expect(img.imageDistance).toBeCloseTo(0.15, 12);
      expect(img.magnification).toBeCloseTo(-0.5, 12);
      expect(img.real).toBe(true);
      expect(img.upright).toBe(false);
      expect(img.size).toBe('reduced');
      expect(img.imageHeight).toBeCloseTo(-0.01, 12);
      expect(concaveObjectZone(0.3, f)).toBe('beyond C (d_o > 2f)');
    });

    it('object at C (d_o = 0.20): d_i = 0.20, m = −1, same size', () => {
      const img = calculateSphericalMirrorImage(f, 0.2, 0.02);
      expect(img.imageDistance).toBeCloseTo(0.2, 12);
      expect(img.magnification).toBeCloseTo(-1, 12);
      expect(img.size).toBe('same size');
      expect(concaveObjectZone(0.2, f)).toBe('at C (d_o = 2f)');
    });

    it('object between C and F (d_o = 0.15): real, inverted, magnified; d_i = 0.30, m = −2', () => {
      const img = calculateSphericalMirrorImage(f, 0.15, 0.02);
      expect(img.imageDistance).toBeCloseTo(0.3, 12);
      expect(img.magnification).toBeCloseTo(-2, 12);
      expect(img.real).toBe(true);
      expect(img.size).toBe('magnified');
      expect(concaveObjectZone(0.15, f)).toBe('between C and F (f < d_o < 2f)');
    });

    it('object at F (d_o = 0.10): singular case reported as image at infinity', () => {
      const img = calculateSphericalMirrorImage(f, 0.1, 0.02);
      expect(img.atInfinity).toBe(true);
      expect(img.imageDistance).toBeNull();
      expect(img.magnification).toBeNull();
      expect(Number.isFinite(img.imageDistance as number)).toBe(false);
      expect(concaveObjectZone(0.1, f)).toBe('at F (d_o = f)');
      expect(describeSphericalMirrorImage(img)).toMatch(/infinity/i);
      // Values approaching f from outside must give very large |d_i|, not NaN.
      const near = calculateSphericalMirrorImage(f, 0.1000001, 0.02);
      expect(near.atInfinity).toBe(false);
      expect(Math.abs(near.imageDistance as number)).toBeGreaterThan(100);
    });

    it('object inside F (d_o = 0.05): virtual, upright, magnified; d_i = −0.10, m = +2', () => {
      const img = calculateSphericalMirrorImage(f, 0.05, 0.02);
      expect(img.imageDistance).toBeCloseTo(-0.1, 12);
      expect(img.magnification).toBeCloseTo(2, 12);
      expect(img.real).toBe(false);
      expect(img.upright).toBe(true);
      expect(img.size).toBe('magnified');
      expect(concaveObjectZone(0.05, f)).toBe('inside F (d_o < f)');
    });

    it('mirror equation holds: 1/f = 1/d_o + 1/d_i for all zones', () => {
      for (const d of [0.05, 0.08, 0.12, 0.2, 0.35, 1.5]) {
        const img = calculateSphericalMirrorImage(f, d, 0.02);
        const inv = 1 / d + 1 / (img.imageDistance as number);
        expect(inv).toBeCloseTo(1 / f, 9);
      }
    });
  });

  describe('convex mirror', () => {
    it('f = −0.10, d_o = 0.20: virtual, upright, reduced; d_i = −1/15, m = +1/3', () => {
      const img = calculateSphericalMirrorImage(-0.1, 0.2, 0.03);
      expect(img.atInfinity).toBe(false);
      expect(img.imageDistance).toBeCloseTo(-0.2 / 3, 12); // −(0.1·0.2)/(0.3)
      expect(img.magnification).toBeCloseTo(1 / 3, 12);
      expect(img.real).toBe(false);
      expect(img.upright).toBe(true);
      expect(img.size).toBe('reduced');
      expect(img.imageHeight).toBeCloseTo(0.01, 12);
    });

    it('a real object in front of a convex mirror always gives a virtual image', () => {
      for (const d of [0.02, 0.1, 0.5, 5]) {
        const img = calculateSphericalMirrorImage(-0.1, d, 0.02);
        expect(img.real).toBe(false);
        expect(img.upright).toBe(true);
        expect((img.imageDistance as number) < 0).toBe(true);
        expect(Math.abs(img.magnification as number)).toBeLessThan(1);
      }
    });
  });

  it('rejects invalid inputs', () => {
    expect(() => calculateSphericalMirrorImage(0.1, 0, 0.02)).toThrow(PhysicsInputError);
    expect(() => calculateSphericalMirrorImage(0.1, -0.2, 0.02)).toThrow(PhysicsInputError);
    expect(() => calculateSphericalMirrorImage(0, 0.2, 0.02)).toThrow(RangeError);
    expect(() => focalLengthFromRadius(-1, 'concave')).toThrow(PhysicsInputError);
  });
});
