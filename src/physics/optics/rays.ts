/**
 * Ray optics — PHYS220 Chapter 35 (§35.4 reflection, §35.5 refraction,
 * §35.8 total internal reflection).
 *
 * Laws:
 *   Reflection:  θ_r = θ_i                (both measured from the normal)
 *   Refraction:  n₁ sin θ₁ = n₂ sin θ₂     (Snell's law)
 *   Index:       n = c / v_medium
 *   Critical angle (only when n₁ > n₂):  θ_c = arcsin(n₂ / n₁)
 *
 * Angles are handled in radians internally; degree helpers are provided.
 */

import { requireFinite, requireInRange, requirePositive } from '../shared/validation';

/** Speed of light in vacuum [m/s] (exact, SI definition). */
export const C_VACUUM = 299_792_458;

export const DEG = Math.PI / 180;

export function degToRad(degrees: number): number {
  requireFinite('degrees', degrees);
  return degrees * DEG;
}

export function radToDeg(radians: number): number {
  requireFinite('radians', radians);
  return radians / DEG;
}

/** Law of reflection: θ_r = θ_i (from the normal). Input validated to [0, π/2). */
export function reflectionAngle(thetaIncidentRad: number): number {
  requireInRange('θᵢ', thetaIncidentRad, 0, Math.PI / 2, { maxInclusive: false });
  return thetaIncidentRad;
}

/** v_medium = c / n [m/s]. */
export function lightSpeedInMedium(n: number): number {
  requirePositive('n', n);
  return C_VACUUM / n;
}

/**
 * Critical angle θ_c = arcsin(n₂/n₁), defined only when n₁ > n₂
 * (light travelling from the optically denser into the rarer medium).
 * Returns null when the condition is not met — TIR is then impossible.
 */
export function criticalAngle(n1: number, n2: number): number | null {
  requirePositive('n₁', n1);
  requirePositive('n₂', n2);
  if (n1 <= n2) return null;
  return Math.asin(n2 / n1);
}

export interface RefractionResult {
  /** Incident angle θ₁ [rad], from the normal. */
  theta1: number;
  /** Refracted angle θ₂ [rad], or null when no propagating refracted ray exists. */
  theta2: number | null;
  /** True when Snell's law yields a propagating transmitted ray. */
  refracted: boolean;
  /** True when sin θ₂ would exceed 1 (only possible if n₁ > n₂ and θ₁ > θ_c). */
  totalInternalReflection: boolean;
  /** Exactly at the critical angle: refracted ray grazes the surface (θ₂ = 90°). */
  atCriticalAngle: boolean;
  /** Critical angle [rad] for this pair of media, or null if n₁ ≤ n₂. */
  criticalAngle: number | null;
  /** The reflected ray always exists (partial reflection is not modeled in intensity). */
  reflected: boolean;
  /** n₂ sin θ₂ / n₁ = sin θ₁ — kept for transparency/debugging. */
  sinTheta2: number;
}

/**
 * Apply Snell's law n₁ sin θ₁ = n₂ sin θ₂, handling total internal
 * reflection and the critical-angle limiting case explicitly.
 */
export function refract(n1: number, n2: number, theta1: number): RefractionResult {
  requirePositive('n₁', n1);
  requirePositive('n₂', n2);
  requireInRange('θ₁', theta1, 0, Math.PI / 2, { maxInclusive: false });

  const sinTheta2 = (n1 * Math.sin(theta1)) / n2;
  const tc = criticalAngle(n1, n2);
  const eps = 1e-12;

  if (sinTheta2 > 1 + eps) {
    return {
      theta1,
      theta2: null,
      refracted: false,
      totalInternalReflection: true,
      atCriticalAngle: false,
      criticalAngle: tc,
      reflected: true,
      sinTheta2,
    };
  }
  if (Math.abs(sinTheta2 - 1) <= eps) {
    return {
      theta1,
      theta2: Math.PI / 2,
      refracted: true,
      totalInternalReflection: false,
      atCriticalAngle: true,
      criticalAngle: tc,
      reflected: true,
      sinTheta2,
    };
  }
  return {
    theta1,
    theta2: Math.asin(sinTheta2),
    refracted: true,
    totalInternalReflection: false,
    atCriticalAngle: false,
    criticalAngle: tc,
    reflected: true,
    sinTheta2,
  };
}

/**
 * Convenience for UI: full reflection + refraction solution in one call.
 * Returns incident, reflected and refracted angle data.
 */
export function reflectionRefractionSolution(
  n1: number,
  n2: number,
  theta1: number,
): { reflection: number; refraction: RefractionResult } {
  return {
    reflection: reflectionAngle(theta1),
    refraction: refract(n1, n2, theta1),
  };
}
