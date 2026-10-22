/**
 * Flat mirror image formation — PHYS220 §36.1.
 *
 * Sign convention (declared, standard "real-is-positive" mirror convention):
 *  - Light comes from the object side; distances measured from the mirror.
 *  - Object distance d_o > 0 for a real object in front of the mirror.
 *  - Image distance d_i < 0 for a virtual image behind the mirror.
 *  - Flat mirror:  d_i = −d_o,  m = +1, image upright, virtual, same size.
 */

import { requireFinite, requirePositive } from '../shared/validation';

export interface FlatMirrorImage {
  /** Object distance d_o [m], > 0 in front of the mirror. */
  objectDistance: number;
  /** Image distance d_i [m]; negative ⇒ behind the mirror (virtual). */
  imageDistance: number;
  /** Magnification m = h_i/h_o = −d_i/d_o = +1 for a flat mirror. */
  magnification: number;
  /** Object height h_o [m]. */
  objectHeight: number;
  /** Image height h_i = m·h_o [m]. */
  imageHeight: number;
  /** Always virtual for a flat mirror and a real object. */
  virtual: true;
  /** Always upright for a flat mirror and a real object. */
  upright: true;
}

export function calculateFlatMirrorImage(
  objectDistance: number,
  objectHeight: number,
): FlatMirrorImage {
  requirePositive('object distance d_o', objectDistance);
  requireFinite('object height h_o', objectHeight);
  return {
    objectDistance,
    imageDistance: -objectDistance,
    magnification: 1,
    objectHeight,
    imageHeight: objectHeight,
    virtual: true,
    upright: true,
  };
}
