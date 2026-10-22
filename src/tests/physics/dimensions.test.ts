import { describe, expect, it } from 'vitest';
import {
  ACCELERATION,
  DIMENSIONLESS,
  ENERGY,
  FORCE,
  FREQUENCY,
  LENGTH,
  LINEAR_DENSITY,
  MASS,
  POWER,
  SPRING_CONSTANT,
  TIME,
  VELOCITY,
  checkEquationConsistency,
  divDimensions,
  formatDimensions,
  isDimensionless,
  mulDimensions,
  powDimensions,
} from '../../physics/mathreview/dimensions';

describe('dimensional analysis (supporting Module A)', () => {
  it('v = √(Tₛ/μ) is dimensionally consistent', () => {
    const inside = divDimensions(FORCE, LINEAR_DENSITY); // (M L T⁻²)/(M L⁻¹) = L² T⁻²
    const v = powDimensions(inside, 0.5);
    expect(v).toEqual(VELOCITY);
  });

  it('ω = √(k/m) has dimensions T⁻¹', () => {
    expect(powDimensions(divDimensions(SPRING_CONSTANT, MASS), 0.5)).toEqual(FREQUENCY);
  });

  it('½ μ ω² A² v has dimensions of power', () => {
    let d = LINEAR_DENSITY;
    d = mulDimensions(d, powDimensions(FREQUENCY, 2));
    d = mulDimensions(d, powDimensions(LENGTH, 2));
    d = mulDimensions(d, VELOCITY);
    expect(d).toEqual(POWER);
  });

  it('½ k x², ½ m v² and energy all agree', () => {
    const u = mulDimensions(SPRING_CONSTANT, powDimensions(LENGTH, 2));
    const k = mulDimensions(MASS, powDimensions(VELOCITY, 2));
    expect(u).toEqual(ENERGY);
    expect(k).toEqual(ENERGY);
    expect(checkEquationConsistency([
      [MASS, powDimensions(ACCELERATION, 1)], // F = m a
      [SPRING_CONSTANT, LENGTH], // and = k x
    ]).consistent).toBe(true);
  });

  it('detects an inconsistent equation', () => {
    const res = checkEquationConsistency([
      [VELOCITY],
      [ACCELERATION], // v = a is inconsistent
    ]);
    expect(res.consistent).toBe(false);
  });

  it('formats dimensions readably', () => {
    expect(formatDimensions(DIMENSIONLESS)).toBe('dimensionless');
    expect(isDimensionless(divDimensions(FORCE, mulDimensions(MASS, ACCELERATION)))).toBe(true);
    expect(formatDimensions(POWER)).toBe('M L² T⁻³');
    expect(formatDimensions(TIME)).toBe('T');
  });
});
