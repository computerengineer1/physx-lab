/**
 * Spherical mirror image formation — PHYS220 §36.2.
 *
 * Sign convention (real-is-positive, documented in the UI):
 *  - Vertex V is the origin; the principal axis points toward the object side.
 *  - Real object in front of the mirror: d_o > 0.
 *  - Concave mirror: f = +R/2 > 0. Convex mirror: f = −R/2 < 0.
 *  - Mirror equation: 1/f = 1/d_o + 1/d_i  ⇒  d_i = f·d_o / (d_o − f).
 *  - Magnification: m = −d_i/d_o = h_i/h_o.
 *  - d_i > 0 ⇒ real image (front side); d_i < 0 ⇒ virtual image (behind).
 *  - m > 0 ⇒ upright; m < 0 ⇒ inverted.
 *  - Paraxial approximation assumed (rays close to the axis).
 *
 * Singular case: d_o = f ⇒ d_i → ∞ (reflected rays are parallel). This is
 * reported explicitly via `atInfinity` instead of returning Infinity/NaN.
 */

import {
  nearlyEqual,
  requireFinite,
  requirePositive,
} from '../shared/validation';

export type MirrorType = 'concave' | 'convex';

export type ImageSize = 'magnified' | 'reduced' | 'same size';

export interface SphericalMirrorImage {
  /** Signed focal length used [m]. */
  focalLength: number;
  /** Object distance d_o [m], > 0. */
  objectDistance: number;
  /** True when d_o = f: image at infinity in the ideal model. */
  atInfinity: boolean;
  /** Image distance d_i [m] (signed), or null when atInfinity. */
  imageDistance: number | null;
  /** Magnification m (signed), or null when atInfinity. */
  magnification: number | null;
  /** Image height h_i = m·h_o [m], or null when atInfinity. */
  imageHeight: number | null;
  /** Derived classification (null at the singular case). */
  real: boolean | null;
  upright: boolean | null;
  size: ImageSize | null;
}

/** f = R/2 for concave, f = −R/2 for convex (R = |radius of curvature| > 0). */
export function focalLengthFromRadius(radius: number, type: MirrorType): number {
  requirePositive('radius of curvature R', radius);
  return type === 'concave' ? radius / 2 : -radius / 2;
}

export function radiusFromFocalLength(focalLength: number): number {
  requireFinite('focal length f', focalLength);
  if (focalLength === 0) {
    throw new RangeError('focal length must be non-zero (f = R/2, R > 0).');
  }
  return 2 * Math.abs(focalLength);
}

export function calculateSphericalMirrorImage(
  focalLength: number,
  objectDistance: number,
  objectHeight: number,
): SphericalMirrorImage {
  requireFinite('focal length f', focalLength);
  if (focalLength === 0) {
    throw new RangeError('focal length must be non-zero for a spherical mirror (f = R/2).');
  }
  requirePositive('object distance d_o', objectDistance);
  requireFinite('object height h_o', objectHeight);

  if (nearlyEqual(objectDistance, focalLength)) {
    // d_o → f: 1/d_i = 1/f − 1/d_o → 0, so |d_i| → ∞ (image at infinity).
    return {
      focalLength,
      objectDistance,
      atInfinity: true,
      imageDistance: null,
      magnification: null,
      imageHeight: null,
      real: null,
      upright: null,
      size: null,
    };
  }

  const imageDistance = (focalLength * objectDistance) / (objectDistance - focalLength);
  const magnification = -imageDistance / objectDistance;
  const imageHeight = magnification * objectHeight;
  const absM = Math.abs(magnification);
  const eps = 1e-9;

  return {
    focalLength,
    objectDistance,
    atInfinity: false,
    imageDistance,
    magnification,
    imageHeight,
    real: imageDistance > 0,
    upright: magnification > 0,
    size: absM > 1 + eps ? 'magnified' : absM < 1 - eps ? 'reduced' : 'same size',
  };
}

export type ConcaveObjectZone =
  | 'beyond C (d_o > 2f)'
  | 'at C (d_o = 2f)'
  | 'between C and F (f < d_o < 2f)'
  | 'at F (d_o = f)'
  | 'inside F (d_o < f)';

/** Zone of the object relative to C and F for a concave mirror (f > 0). */
export function concaveObjectZone(objectDistance: number, focalLength: number): ConcaveObjectZone {
  requirePositive('object distance d_o', objectDistance);
  requirePositive('focal length f', focalLength);
  const c = 2 * focalLength;
  if (nearlyEqual(objectDistance, focalLength)) return 'at F (d_o = f)';
  if (nearlyEqual(objectDistance, c)) return 'at C (d_o = 2f)';
  if (objectDistance > c) return 'beyond C (d_o > 2f)';
  if (objectDistance > focalLength) return 'between C and F (f < d_o < 2f)';
  return 'inside F (d_o < f)';
}

/** Human-readable classification derived from calculated values (not presets). */
export function describeSphericalMirrorImage(img: SphericalMirrorImage): string {
  if (img.atInfinity) {
    return 'Object at the focal point: reflected rays are parallel — the ideal image is at infinity (no finite image is formed).';
  }
  const di = img.imageDistance as number;
  const m = img.magnification as number;
  const parts: string[] = [];
  parts.push(img.real ? 'Real image (in front of the mirror)' : 'Virtual image (behind the mirror)');
  parts.push(m > 0 ? 'upright' : 'inverted');
  parts.push(`${img.size} (|m| = ${Math.abs(m).toFixed(3)})`);
  parts.push(`d_i = ${di.toFixed(3)} m`);
  return parts.join(', ');
}
