import type { FormulaItem } from './types';

/**
 * Single source of truth for the formula notebook and the per-lab equation
 * panels. Every formula here is implemented by the corresponding function
 * in src/physics — the TeX is documentation of the same model.
 */
export const FORMULAS: FormulaItem[] = [
  // ---- Module A (supporting) ----
  {
    id: 'radians',
    moduleId: 'math-review',
    title: 'Degrees and radians',
    tex: '\\theta_{\\text{rad}} = \\theta_{\\text{deg}} \\cdot \\frac{\\pi}{180}',
    variables: [
      { sym: '\\theta_{\\text{rad}}', name: 'angle in radians', unit: 'rad' },
      { sym: '\\theta_{\\text{deg}}', name: 'angle in degrees', unit: '°' },
    ],
    note: 'A full turn is 360° = 2π rad. Calculus formulas for sin/cos require radians.',
  },
  {
    id: 'sinusoid',
    moduleId: 'math-review',
    title: 'General sinusoid',
    tex: 'y(x) = A\\sin(Bx + C) + D',
    variables: [
      { sym: 'A', name: 'amplitude', unit: '[units of y]' },
      { sym: 'B', name: 'angular rate; period = 2π/B', unit: 'rad/[unit of x]' },
      { sym: 'C', name: 'phase offset; shift = −C/B', unit: 'rad' },
      { sym: 'D', name: 'vertical offset', unit: '[units of y]' },
    ],
    note: 'Supporting study material for reading wave and oscillator graphs.',
  },

  // ---- Module B · Chapter 15 ----
  {
    id: 'hooke',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.1',
    title: 'Spring (Hooke’s) force',
    tex: 'F_s = -kx',
    variables: [
      { sym: 'F_s', name: 'spring force', unit: 'N' },
      { sym: 'k', name: 'spring constant', unit: 'N/m' },
      { sym: 'x', name: 'displacement from equilibrium', unit: 'm' },
    ],
    note: 'Ideal spring, displacement measured from equilibrium.',
  },
  {
    id: 'shm-ode',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.1',
    title: 'Equation of motion',
    tex: 'm\\frac{d^2x}{dt^2} + kx = 0',
    variables: [
      { sym: 'm', name: 'mass', unit: 'kg' },
      { sym: 'k', name: 'spring constant', unit: 'N/m' },
    ],
    note: 'Newton’s second law with F = −kx; the defining ODE of SHM.',
  },
  {
    id: 'shm-omega',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.2',
    title: 'Angular frequency',
    tex: '\\omega = \\sqrt{\\frac{k}{m}}',
    variables: [
      { sym: '\\omega', name: 'angular frequency', unit: 'rad/s' },
    ],
    note: 'Dimensional check: √(N·m⁻¹/kg) = √(s⁻²) = s⁻¹ ✓',
  },
  {
    id: 'shm-period',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.2',
    title: 'Period and frequency',
    tex: 'T = 2\\pi\\sqrt{\\frac{m}{k}}, \\qquad f = \\frac{1}{T} = \\frac{\\omega}{2\\pi}',
    variables: [
      { sym: 'T', name: 'period', unit: 's' },
      { sym: 'f', name: 'frequency', unit: 'Hz' },
    ],
  },
  {
    id: 'shm-x',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.2',
    title: 'SHM position, velocity, acceleration',
    tex: 'x(t) = A\\cos(\\omega t + \\varphi),\\quad v(t) = -A\\omega\\sin(\\omega t + \\varphi),\\quad a(t) = -\\omega^2 x(t)',
    variables: [
      { sym: 'A', name: 'amplitude', unit: 'm' },
      { sym: '\\varphi', name: 'phase constant', unit: 'rad' },
      { sym: 'v', name: 'velocity', unit: 'm/s' },
      { sym: 'a', name: 'acceleration', unit: 'm/s²' },
    ],
    note: 'v_max = Aω at equilibrium; a_max = Aω² at the turning points.',
  },
  {
    id: 'shm-ic',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.2',
    title: 'Amplitude and phase from initial conditions',
    tex: 'A = \\sqrt{x_0^2 + \\left(\\frac{v_0}{\\omega}\\right)^2}, \\qquad \\varphi = \\operatorname{atan2}\\!\\left(-\\frac{v_0}{\\omega},\\, x_0\\right)',
    variables: [
      { sym: 'x_0', name: 'initial position', unit: 'm' },
      { sym: 'v_0', name: 'initial velocity', unit: 'm/s' },
    ],
  },
  {
    id: 'shm-energy',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.3',
    title: 'Oscillator energies',
    tex: 'K = \\tfrac{1}{2}mv^2,\\quad U_s = \\tfrac{1}{2}kx^2,\\quad E = K + U_s = \\tfrac{1}{2}kA^2',
    variables: [
      { sym: 'K', name: 'kinetic energy', unit: 'J' },
      { sym: 'U_s', name: 'spring potential energy', unit: 'J' },
      { sym: 'E', name: 'total mechanical energy (constant)', unit: 'J' },
    ],
    note: 'Doubling A quadruples E (E ∝ A²).',
  },
  {
    id: 'circ-proj',
    moduleId: 'oscillatory-motion',
    sectionRef: '§15.4',
    title: 'SHM as a circular-motion projection',
    tex: 'x(t) = A\\cos(\\omega t + \\varphi) \\;\\Longleftrightarrow\\; \\text{projection of } (A\\cos\\theta,\\, A\\sin\\theta),\\ \\theta = \\omega t + \\varphi',
    variables: [
      { sym: 'A', name: 'circle radius = oscillation amplitude', unit: 'm' },
      { sym: '\\omega', name: 'constant angular speed', unit: 'rad/s' },
    ],
  },

  // ---- Module C · Chapter 16 ----
  {
    id: 'wave-fn',
    moduleId: 'wave-motion',
    sectionRef: '§16.2',
    title: 'Sinusoidal travelling wave',
    tex: 'y(x,t) = A\\sin(kx - \\omega t + \\varphi)',
    variables: [
      { sym: 'y', name: 'transverse displacement', unit: 'm' },
      { sym: 'A', name: 'amplitude', unit: 'm' },
      { sym: 'k', name: 'wave number = 2π/λ', unit: 'rad/m' },
      { sym: '\\omega', name: 'angular frequency = 2πf', unit: 'rad/s' },
      { sym: '\\varphi', name: 'phase constant', unit: 'rad' },
    ],
    note: 'kx − ωt ⇒ propagation toward +x; kx + ωt ⇒ toward −x.',
  },
  {
    id: 'wave-k-omega',
    moduleId: 'wave-motion',
    sectionRef: '§16.2',
    title: 'Wave number and angular frequency',
    tex: 'k = \\frac{2\\pi}{\\lambda}, \\qquad \\omega = 2\\pi f = \\frac{2\\pi}{T}',
    variables: [
      { sym: '\\lambda', name: 'wavelength', unit: 'm' },
      { sym: 'f', name: 'frequency', unit: 'Hz' },
      { sym: 'T', name: 'period', unit: 's' },
    ],
  },
  {
    id: 'wave-v',
    moduleId: 'wave-motion',
    sectionRef: '§16.2',
    title: 'Wave speed (any periodic wave)',
    tex: 'v = \\frac{\\omega}{k} = f\\lambda',
    variables: [{ sym: 'v', name: 'propagation speed', unit: 'm/s' }],
  },
  {
    id: 'string-v',
    moduleId: 'wave-motion',
    sectionRef: '§16.3',
    title: 'Speed of waves on a stretched string',
    tex: 'v = \\sqrt{\\frac{T_s}{\\mu}}',
    variables: [
      { sym: 'T_s', name: 'string tension (not the period!)', unit: 'N' },
      { sym: '\\mu', name: 'linear mass density', unit: 'kg/m' },
    ],
    note: 'Dimensional check: √(N/(kg/m)) = √(m²/s²) = m/s ✓',
  },
  {
    id: 'wave-power',
    moduleId: 'wave-motion',
    sectionRef: '§16.4',
    title: 'Average power of a sinusoidal wave on a string',
    tex: '\\mathcal{P}_{\\text{avg}} = \\tfrac{1}{2}\\,\\mu\\,\\omega^2 A^2 v',
    variables: [
      { sym: '\\mathcal{P}_{avg}', name: 'time-averaged power', unit: 'W' },
      { sym: '\\mu', name: 'linear mass density', unit: 'kg/m' },
      { sym: '\\omega', name: 'angular frequency', unit: 'rad/s' },
      { sym: 'A', name: 'amplitude', unit: 'm' },
      { sym: 'v', name: 'wave speed', unit: 'm/s' },
    ],
    note: 'Ideal string, sinusoidal wave, no dissipation.',
  },

  // ---- Module D · Chapter 18 ----
  {
    id: 'superposition',
    moduleId: 'interference',
    sectionRef: '§18.1',
    title: 'Superposition principle',
    tex: 'y_{\\text{total}}(x,t) = y_1(x,t) + y_2(x,t)',
    variables: [{ sym: 'y_i', name: 'individual wave displacements', unit: 'm' }],
    note: 'Linear media: waves pass through each other unchanged.',
  },
  {
    id: 'resultant-amp',
    moduleId: 'interference',
    sectionRef: '§18.1',
    title: 'Resultant amplitude (same k and ω)',
    tex: 'A_R = \\sqrt{A_1^2 + A_2^2 + 2A_1A_2\\cos\\Delta\\varphi}',
    variables: [
      { sym: '\\Delta\\varphi', name: 'phase difference', unit: 'rad' },
    ],
    note: 'Δφ = 0 ⇒ A_R = A1 + A2 (constructive); Δφ = π ⇒ A_R = |A1 − A2| (destructive).',
  },
  {
    id: 'standing-wave',
    moduleId: 'interference',
    sectionRef: '§18.2',
    title: 'Standing wave from counter-propagating waves',
    tex: 'y(x,t) = 2A\\sin(kx)\\cos(\\omega t)',
    variables: [
      { sym: '2A', name: 'maximum envelope displacement', unit: 'm' },
    ],
    note: 'Nodes at kx = mπ; antinodes at kx = (m + ½)π.',
  },
  {
    id: 'harmonics',
    moduleId: 'interference',
    sectionRef: '§18.4',
    title: 'String fixed at both ends — normal modes',
    tex: '\\lambda_n = \\frac{2L}{n}, \\qquad f_n = \\frac{nv}{2L} = n f_1, \\qquad n = 1, 2, 3, \\dots',
    variables: [
      { sym: 'L', name: 'string length', unit: 'm' },
      { sym: 'n', name: 'harmonic number', unit: '—' },
      { sym: 'v', name: 'string wave speed', unit: 'm/s' },
    ],
    note: 'n half-wavelengths fit on the string; n + 1 nodes including endpoints.',
  },

  // ---- Module E · Chapter 35 ----
  {
    id: 'reflection',
    moduleId: 'ray-optics',
    sectionRef: '§35.4',
    title: 'Law of reflection',
    tex: '\\theta_r = \\theta_i',
    variables: [
      { sym: '\\theta_i', name: 'angle of incidence (from the normal)', unit: '° or rad' },
      { sym: '\\theta_r', name: 'angle of reflection (from the normal)', unit: '° or rad' },
    ],
  },
  {
    id: 'snell',
    moduleId: 'ray-optics',
    sectionRef: '§35.5',
    title: 'Snell’s law of refraction',
    tex: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2',
    variables: [
      { sym: 'n_1, n_2', name: 'refractive indices of media 1, 2', unit: '—' },
      { sym: '\\theta_1, \\theta_2', name: 'angles from the normal', unit: '° or rad' },
    ],
  },
  {
    id: 'index-speed',
    moduleId: 'ray-optics',
    sectionRef: '§35.5',
    title: 'Index of refraction and light speed',
    tex: 'n = \\frac{c}{v_{\\text{medium}}}',
    variables: [
      { sym: 'c', name: 'speed of light in vacuum = 2.998 × 10⁸ m/s', unit: 'm/s' },
      { sym: 'v_{medium}', name: 'speed of light in the medium', unit: 'm/s' },
    ],
  },
  {
    id: 'critical-angle',
    moduleId: 'ray-optics',
    sectionRef: '§35.8',
    title: 'Critical angle (requires n₁ > n₂)',
    tex: '\\theta_c = \\arcsin\\!\\left(\\frac{n_2}{n_1}\\right)',
    variables: [
      { sym: '\\theta_c', name: 'critical angle', unit: '° or rad' },
    ],
    note: 'For θ₁ > θ_c all light is reflected — total internal reflection.',
  },

  // ---- Module F · Chapter 36 ----
  {
    id: 'flat-mirror',
    moduleId: 'image-formation',
    sectionRef: '§36.1',
    title: 'Flat mirror image',
    tex: 'd_i = -d_o, \\qquad m = +1',
    variables: [
      { sym: 'd_o', name: 'object distance (front of mirror)', unit: 'm' },
      { sym: 'd_i', name: 'image distance (negative ⇒ behind mirror)', unit: 'm' },
      { sym: 'm', name: 'magnification', unit: '—' },
    ],
    note: 'Virtual, upright, same size — for a real object in front of the mirror.',
  },
  {
    id: 'mirror-eq',
    moduleId: 'image-formation',
    sectionRef: '§36.2',
    title: 'Mirror equation and magnification',
    tex: '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}, \\qquad m = \\frac{h_i}{h_o} = -\\frac{d_i}{d_o}',
    variables: [
      { sym: 'f', name: 'focal length (concave > 0, convex < 0)', unit: 'm' },
      { sym: 'd_i', name: 'image distance (> 0 real, < 0 virtual)', unit: 'm' },
      { sym: 'm', name: 'magnification (> 0 upright, < 0 inverted)', unit: '—' },
    ],
    note: 'Real-is-positive convention; paraxial approximation assumed. d_o = f ⇒ image at infinity.',
  },
  {
    id: 'focal-radius',
    moduleId: 'image-formation',
    sectionRef: '§36.2',
    title: 'Focal length and radius of curvature',
    tex: 'f = \\frac{R}{2}',
    variables: [
      { sym: 'R', name: 'radius of curvature (signed by mirror type)', unit: 'm' },
    ],
  },
];

export function formulasForModule(moduleId: string): FormulaItem[] {
  return FORMULAS.filter((f) => f.moduleId === moduleId);
}
