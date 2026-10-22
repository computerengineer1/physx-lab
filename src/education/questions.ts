import type { PracticeQuestion } from './types';
import {
  shmAngularFrequency,
  shmFrequency,
  shmPeriod,
} from '../physics/shm/shm';
import { totalOscillatorEnergy } from '../physics/shm/energy';
import {
  angularFrequency,
  waveNumber,
  waveSpeedFromFrequencyAndWavelength,
} from '../physics/waves/travelling';
import {
  averageWavePower,
  harmonicFrequency,
  harmonicWavelength,
  stringWaveSpeed,
} from '../physics/waves/string';
import { resultantAmplitude } from '../physics/interference/superposition';
import { C_VACUUM, criticalAngle, degToRad, lightSpeedInMedium, radToDeg, refract } from '../physics/optics/rays';
import { calculateSphericalMirrorImage, describeSphericalMirrorImage } from '../physics/mirrors/spherical';

/**
 * Original practice-question generators for every syllabus module.
 * Numerical answers are ALWAYS computed by the same physics functions the
 * simulations use, with randomized-but-valid parameter ranges, and each
 * question carries a full worked solution (knowns → equation → substitution
 * → calculation → unit check → interpretation).
 */

const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const r1 = (lo: number, hi: number) => Math.round(r(lo, hi) * 10) / 10;
const r2 = (lo: number, hi: number) => Math.round(r(lo, hi) * 100) / 100;
const r3 = (lo: number, hi: number) => Math.round(r(lo, hi) * 1000) / 1000;
const ri = (lo: number, hi: number) => Math.round(r(lo, hi));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Compact number formatting for solution text. */
const fmt = (v: number, d = 3): string => {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(d);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
};

function shuffled(correct: string, distractors: string[]): { options: string[]; correctIndex: number } {
  const all = [correct, ...distractors];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { options: all, correctIndex: all.indexOf(correct) };
}

let qid = 0;
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${qid++}`;

/* ============================ Module B · Chapter 15 ============================ */

function qShmPeriod(): PracticeQuestion {
  const m = r1(0.2, 3);
  const k = r1(5, 80);
  const T = shmPeriod({ k, m });
  return {
    id: id('shmT'),
    simTarget: 'spring',
    kind: 'numeric',
    prompt: `A block of mass $m = ${fmt(m)}\\ \\mathrm{kg}$ is attached to an ideal spring with $k = ${fmt(k)}\\ \\mathrm{N/m}$ and released. What is the oscillation period $T$?`,
    answer: T,
    unit: 's',
    tolerancePct: 0.02,
    simParams: { m, k },
    steps: [
      `**Known:** $m = ${fmt(m)}\\ \\mathrm{kg}$, $k = ${fmt(k)}\\ \\mathrm{N/m}$.`,
      `**Required:** period $T$.`,
      `**Equation:** $T = 2\\pi\\sqrt{m/k}$.`,
      `**Rearranged:** already solved for $T$.`,
      `**Substitution:** $T = 2\\pi\\sqrt{${fmt(m)}/${fmt(k)}}$.`,
      `**Calculation:** $\\omega = \\sqrt{k/m} = ${fmt(shmAngularFrequency({ k, m }), 4)}\\ \\mathrm{rad/s}$, so $T = 2\\pi/\\omega = ${fmt(T, 4)}\\ \\mathrm{s}$.`,
      `**Unit check:** $\\sqrt{\\mathrm{kg}/(\\mathrm{N/m})} = \\sqrt{\\mathrm{kg}\\cdot\\mathrm{m}/(\\mathrm{kg}\\cdot\\mathrm{m/s^2})} = \\sqrt{\\mathrm{s^2}} = \\mathrm{s}$ ✓`,
      `**Answer:** $T \\approx ${fmt(T)}\\ \\mathrm{s}$ (frequency $f = ${fmt(shmFrequency({ k, m }))}\\ \\mathrm{Hz}$).`,
    ],
  };
}

function qShmEnergy(): PracticeQuestion {
  const k = r1(10, 120);
  const A = r2(0.02, 0.3);
  const E = totalOscillatorEnergy(k, A);
  return {
    id: id('shmE'),
    simTarget: 'energy',
    kind: 'numeric',
    prompt: `An ideal oscillator has spring constant $k = ${fmt(k)}\\ \\mathrm{N/m}$ and amplitude $A = ${fmt(A)}\\ \\mathrm{m}$. What is its total mechanical energy $E$?`,
    answer: E,
    unit: 'J',
    tolerancePct: 0.02,
    simParams: { k, x0: A, v0: 0 },
    steps: [
      `**Known:** $k = ${fmt(k)}\\ \\mathrm{N/m}$, $A = ${fmt(A)}\\ \\mathrm{m}$.`,
      `**Required:** total energy $E$.`,
      `**Equation:** $E = \\tfrac{1}{2}kA^2$ (constant for an ideal oscillator).`,
      `**Substitution:** $E = 0.5 \\cdot ${fmt(k)} \\cdot (${fmt(A)})^2$.`,
      `**Calculation:** $E = ${fmt(E, 4)}\\ \\mathrm{J}$.`,
      `**Unit check:** $(\\mathrm{N/m})\\cdot\\mathrm{m^2} = \\mathrm{N\\cdot m} = \\mathrm{J}$ ✓`,
      `**Interpretation:** at every instant $K + U_s = ${fmt(E)}\\ \\mathrm{J}$; energy sloshes between kinetic and potential but the total is fixed.`,
    ],
  };
}

function qShmMassChange(): PracticeQuestion {
  const m = r1(0.5, 2);
  const k = r1(10, 60);
  const factor = 4;
  const T1 = shmPeriod({ k, m });
  const T2 = shmPeriod({ k, m: m * factor });
  const ratio = T2 / T1; // = 2 exactly
  const { options, correctIndex } = shuffled(
    `It doubles (factor ${fmt(ratio, 2)})`,
    ['It stays the same', 'It quadruples', 'It halves'],
  );
  return {
    id: id('shmM'),
    simTarget: 'spring',
    kind: 'mcq',
    prompt: `An oscillator has $m = ${fmt(m)}\\ \\mathrm{kg}$, $k = ${fmt(k)}\\ \\mathrm{N/m}$, period $T = ${fmt(T1)}\\ \\mathrm{s}$. The mass is replaced by $4m$ while the spring stays the same. What happens to the period?`,
    options,
    correctIndex,
    simParams: { m, k },
    steps: [
      `**Equation:** $T = 2\\pi\\sqrt{m/k}$, so $T \\propto \\sqrt{m}$.`,
      `**Substitution:** $T' = 2\\pi\\sqrt{4m/k} = 2 \\cdot 2\\pi\\sqrt{m/k} = 2T$.`,
      `**Calculation:** $T = ${fmt(T1)}\\ \\mathrm{s} \\Rightarrow T' = ${fmt(T2)}\\ \\mathrm{s}$ (ratio ${fmt(ratio, 3)}).`,
      `**Interpretation:** quadrupling the mass doubles the period — heavier objects oscillate more slowly on the same spring.`,
    ],
  };
}

function qShmTF(): PracticeQuestion {
  const wrong = Math.random() < 0.5;
  const prompt = wrong
    ? 'True or false: in SHM the speed of the mass is greatest at the turning points (maximum displacement).'
    : 'True or false: in SHM the acceleration of the mass is greatest at the turning points (maximum displacement).';
  return {
    id: id('shmTF'),
    kind: 'tf',
    prompt,
    options: ['True', 'False'],
    correctIndex: wrong ? 1 : 0,
    steps: wrong
      ? [
          '**Model:** $v(t) = -A\\omega\\sin(\\omega t + \\varphi)$.',
          'At a turning point $x = \\pm A$, the phase makes $\\sin = 0$, so $v = 0$.',
          '**Conclusion:** speed is *zero* at the turning points and maximal ($A\\omega$) at equilibrium — the statement is **false**.',
        ]
      : [
          '**Model:** $a = -\\omega^2 x$.',
          'At a turning point $|x| = A$ is maximal, so $|a| = \\omega^2 A$ is maximal.',
          '**Conclusion:** the statement is **true** (the acceleration is directed back toward equilibrium).',
        ],
  };
}

/* ============================ Module C · Chapter 16 ============================ */

function qStringSpeed(): PracticeQuestion {
  const tension = r1(20, 200);
  const mu = r3(0.002, 0.05);
  const v = stringWaveSpeed(tension, mu);
  return {
    id: id('strV'),
    simTarget: 'string-speed',
    kind: 'numeric',
    prompt: `A string under tension $T_s = ${fmt(tension)}\\ \\mathrm{N}$ has linear mass density $\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$. What is the speed $v$ of transverse waves on it?`,
    answer: v,
    unit: 'm/s',
    tolerancePct: 0.02,
    simParams: { tension, mu },
    steps: [
      `**Known:** $T_s = ${fmt(tension)}\\ \\mathrm{N}$, $\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$.`,
      `**Equation:** $v = \\sqrt{T_s/\\mu}$.`,
      `**Substitution:** $v = \\sqrt{${fmt(tension)}/${fmt(mu)}}$.`,
      `**Calculation:** $v = ${fmt(v, 2)}\\ \\mathrm{m/s}$.`,
      `**Unit check:** $\\sqrt{\\mathrm{N}\\cdot\\mathrm{m/kg}} = \\sqrt{\\mathrm{m^2/s^2}} = \\mathrm{m/s}$ ✓`,
      `**Interpretation:** $v$ grows with the square root of tension — 4× the tension gives only 2× the speed.`,
    ],
  };
}

function qWaveSpeed(): PracticeQuestion {
  const f = r1(2, 60);
  const lambda = r2(0.05, 3);
  const v = waveSpeedFromFrequencyAndWavelength(f, lambda);
  return {
    id: id('wavV'),
    simTarget: 'travelling',
    kind: 'numeric',
    prompt: `A sinusoidal wave has frequency $f = ${fmt(f)}\\ \\mathrm{Hz}$ and wavelength $\\lambda = ${fmt(lambda)}\\ \\mathrm{m}$. What is its propagation speed?`,
    answer: v,
    unit: 'm/s',
    tolerancePct: 0.02,
    simParams: { frequency: f, wavelength: lambda },
    steps: [
      `**Known:** $f = ${fmt(f)}\\ \\mathrm{Hz}$, $\\lambda = ${fmt(lambda)}\\ \\mathrm{m}$.`,
      `**Equation:** $v = f\\lambda$ (equivalently $v = \\omega/k$ with $\\omega = ${fmt(angularFrequency(f), 2)}\\ \\mathrm{rad/s}$, $k = ${fmt(waveNumber(lambda), 3)}\\ \\mathrm{rad/m}$).`,
      `**Substitution:** $v = ${fmt(f)} \\times ${fmt(lambda)}$.`,
      `**Calculation:** $v = ${fmt(v, 3)}\\ \\mathrm{m/s}$.`,
      `**Unit check:** $\\mathrm{Hz}\\cdot\\mathrm{m} = \\mathrm{m/s}$ ✓`,
    ],
  };
}

function qWavePower(): PracticeQuestion {
  const mu = r3(0.005, 0.04);
  const f = r1(5, 40);
  const A = r2(0.01, 0.08);
  const tension = r1(30, 150);
  const v = stringWaveSpeed(tension, mu);
  const omega = angularFrequency(f);
  const P = averageWavePower({ linearDensity: mu, angularFrequency: omega, amplitude: A, speed: v });
  return {
    id: id('wavP'),
    simTarget: 'power',
    kind: 'numeric',
    prompt: `A string ($\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$, tension $T_s = ${fmt(tension)}\\ \\mathrm{N}$) carries a sinusoidal wave of amplitude $A = ${fmt(A)}\\ \\mathrm{m}$ and frequency $f = ${fmt(f)}\\ \\mathrm{Hz}$. What is the average power $\\mathcal{P}_{avg}$ transported?`,
    answer: P,
    unit: 'W',
    tolerancePct: 0.03,
    simParams: { mu, tension, frequency: f, amplitude: A },
    steps: [
      `**Known:** $\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$, $T_s = ${fmt(tension)}\\ \\mathrm{N}$, $A = ${fmt(A)}\\ \\mathrm{m}$, $f = ${fmt(f)}\\ \\mathrm{Hz}$.`,
      `**Intermediate:** $v = \\sqrt{T_s/\\mu} = ${fmt(v, 2)}\\ \\mathrm{m/s}$; $\\omega = 2\\pi f = ${fmt(omega, 2)}\\ \\mathrm{rad/s}$.`,
      `**Equation:** $\\mathcal{P}_{avg} = \\tfrac12 \\mu \\omega^2 A^2 v$.`,
      `**Substitution:** $\\mathcal{P}_{avg} = 0.5 \\cdot ${fmt(mu)} \\cdot (${fmt(omega, 2)})^2 \\cdot (${fmt(A)})^2 \\cdot ${fmt(v, 2)}$.`,
      `**Calculation:** $\\mathcal{P}_{avg} = ${fmt(P, 3)}\\ \\mathrm{W}$.`,
      `**Unit check:** $(\\mathrm{kg/m})(\\mathrm{s^{-2}})(\\mathrm{m^2})(\\mathrm{m/s}) = \\mathrm{kg\\,m^2/s^3} = \\mathrm{W}$ ✓`,
      `**Interpretation:** power scales with $A^2$ and $\\omega^2$ — doubling either quadruples the transported power.`,
    ],
  };
}

function qTensionMCQ(): PracticeQuestion {
  const mu = r2(0.005, 0.03);
  const T1 = r1(20, 80);
  const v1 = stringWaveSpeed(T1, mu);
  const v2 = stringWaveSpeed(4 * T1, mu);
  const { options, correctIndex } = shuffled(
    'Increases by a factor of 2',
    ['Increases by a factor of 4', 'Stays the same', 'Increases by a factor of 16'],
  );
  return {
    id: id('tenMCQ'),
    simTarget: 'string-speed',
    kind: 'mcq',
    prompt: `With $\\mu$ fixed, the tension of a string is quadrupled ($T_s \\to 4T_s$). How does the wave speed change? (Currently $v = ${fmt(v1, 1)}\\ \\mathrm{m/s}$.)`,
    options,
    correctIndex,
    simParams: { tension: T1, mu },
    steps: [
      `**Equation:** $v = \\sqrt{T_s/\\mu} \\Rightarrow v \\propto \\sqrt{T_s}$.`,
      `**Substitution:** $v' = \\sqrt{4T_s/\\mu} = 2\\sqrt{T_s/\\mu} = 2v$.`,
      `**Calculation:** $v = ${fmt(v1, 2)}\\ \\mathrm{m/s} \\to v' = ${fmt(v2, 2)}\\ \\mathrm{m/s}$.`,
      `**Interpretation:** square-root dependence — quadrupling tension only doubles the speed.`,
    ],
  };
}

/* ============================ Module D · Chapter 18 ============================ */

function qResultantAmplitude(): PracticeQuestion {
  const A1 = r2(0.02, 0.08);
  const A2 = r2(0.02, 0.08);
  const dphiDeg = pick([0, 30, 60, 90, 120, 180]);
  const AR = resultantAmplitude(A1, A2, degToRad(dphiDeg));
  return {
    id: id('supA'),
    simTarget: 'superposition',
    kind: 'numeric',
    prompt: `Two co-propagating sinusoidal waves (same $k$ and $\\omega$) have $A_1 = ${fmt(A1)}\\ \\mathrm{m}$, $A_2 = ${fmt(A2)}\\ \\mathrm{m}$ and phase difference $\\Delta\\varphi = ${dphiDeg}^\\circ$. What is the resultant amplitude $A_R$?`,
    answer: AR,
    unit: 'm',
    tolerancePct: 0.02,
    simParams: { a1: A1, a2: A2, dphi: dphiDeg },
    steps: [
      `**Known:** $A_1 = ${fmt(A1)}\\ \\mathrm{m}$, $A_2 = ${fmt(A2)}\\ \\mathrm{m}$, $\\Delta\\varphi = ${dphiDeg}^\\circ = ${fmt(degToRad(dphiDeg), 4)}\\ \\mathrm{rad}$.`,
      `**Equation:** $A_R = \\sqrt{A_1^2 + A_2^2 + 2A_1A_2\\cos\\Delta\\varphi}$.`,
      `**Substitution:** $A_R = \\sqrt{(${fmt(A1)})^2 + (${fmt(A2)})^2 + 2(${fmt(A1)})(${fmt(A2)})\\cos(${dphiDeg}^\\circ)}$.`,
      `**Calculation:** $A_R = ${fmt(AR, 4)}\\ \\mathrm{m}$.`,
      `**Sanity bounds:** $|A_1 - A_2| = ${fmt(Math.abs(A1 - A2))} \\le A_R \\le A_1 + A_2 = ${fmt(A1 + A2)}$ ✓`,
      `**Interpretation:** ${dphiDeg === 0 ? 'fully constructive — amplitudes add.' : dphiDeg === 180 ? 'fully destructive — amplitudes subtract.' : 'partial interference.'}`,
    ],
  };
}

function qHarmonicFrequency(): PracticeQuestion {
  const L = r1(0.5, 3);
  const tension = r1(30, 160);
  const mu = r3(0.004, 0.03);
  const n = ri(2, 5);
  const v = stringWaveSpeed(tension, mu);
  const fn = harmonicFrequency(L, v, n);
  const ln = harmonicWavelength(L, n);
  return {
    id: id('harmF'),
    simTarget: 'harmonics',
    kind: 'numeric',
    prompt: `A string of length $L = ${fmt(L)}\\ \\mathrm{m}$ fixed at both ends has $\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$ under tension $T_s = ${fmt(tension)}\\ \\mathrm{N}$. What is the frequency $f_${n}$ of harmonic $n = ${n}$?`,
    answer: fn,
    unit: 'Hz',
    tolerancePct: 0.02,
    simParams: { L, tension, mu, n },
    steps: [
      `**Known:** $L = ${fmt(L)}\\ \\mathrm{m}$, $T_s = ${fmt(tension)}\\ \\mathrm{N}$, $\\mu = ${fmt(mu)}\\ \\mathrm{kg/m}$, $n = ${n}$.`,
      `**Wave speed:** $v = \\sqrt{T_s/\\mu} = ${fmt(v, 2)}\\ \\mathrm{m/s}$.`,
      `**Boundary condition:** $\\lambda_n = 2L/n = ${fmt(ln, 3)}\\ \\mathrm{m}$.`,
      `**Equation:** $f_n = v/\\lambda_n = nv/(2L)$.`,
      `**Calculation:** $f_${n} = ${n} \\cdot ${fmt(v, 2)} / (2 \\cdot ${fmt(L)}) = ${fmt(fn, 2)}\\ \\mathrm{Hz}$.`,
      `**Unit check:** $(\\mathrm{m/s})/\\mathrm{m} = \\mathrm{s^{-1}} = \\mathrm{Hz}$ ✓`,
      `**Interpretation:** mode $n = ${n}$ has ${n} half-wavelengths on the string and ${n + 1} nodes (endpoints included).`,
    ],
  };
}

function qDestructivePhase(): PracticeQuestion {
  const { options, correctIndex } = shuffled('$\\pi$ rad (180°)', ['0 rad', '$\\pi/2$ rad (90°)', '$2\\pi$ rad (360°)']);
  return {
    id: id('desPh'),
    kind: 'mcq',
    prompt: 'Two identical sinusoidal waves travelling in the same direction interfere. Which phase difference makes the interference fully destructive?',
    options,
    correctIndex,
    steps: [
      '**Equation:** $A_R = \\sqrt{A_1^2 + A_2^2 + 2A_1A_2\\cos\\Delta\\varphi}$.',
      '**Condition:** full cancellation with $A_1 = A_2 = A$ requires $A_R = 0$, i.e. $\\cos\\Delta\\varphi = -1$.',
      '**Solution:** $\\Delta\\varphi = \\pi$ rad. Then $A_R = \\sqrt{2A^2 - 2A^2} = 0$ — crest meets trough everywhere.',
      `**Check with the model:** $A_R(\\pi) = ${fmt(resultantAmplitude(0.05, 0.05, Math.PI), 6)}\\ \\mathrm{m}$ for $A = 0.05\\ \\mathrm{m}$.`,
    ],
  };
}

function qStandingNodes(): PracticeQuestion {
  const n = ri(2, 6);
  const L = r1(1, 4);
  return {
    id: id('stN'),
    simTarget: 'harmonics',
    kind: 'numeric',
    prompt: `A string fixed at both ends vibrates in harmonic $n = ${n}$ on a length $L = ${fmt(L)}\\ \\mathrm{m}$. How many nodes does the standing wave have (including both endpoints)?`,
    answer: n + 1,
    unit: 'nodes',
    tolerancePct: 0,
    simParams: { n, L },
    steps: [
      '**Model:** $y = 2A\\sin(kx)\\cos(\\omega t)$ with boundary condition $kL = n\\pi$, so nodes at $x = mL/n$, $m = 0, \\dots, n$.',
      `**Count:** $m$ runs from 0 to ${n} — that is ${n + 1} positions.`,
      `**Positions (this string):** $x = 0, ${fmt(L / n)}, ${fmt((2 * L) / n)}, \\dots, ${fmt(L)}\\ \\mathrm{m}$.`,
      `**Answer:** ${n + 1} nodes and ${n} antinodes.`,
    ],
  };
}

/* ============================ Module E · Chapter 35 ============================ */

function qSnell(): PracticeQuestion {
  const materials: [string, number][] = [
    ['air', 1.0],
    ['water', 1.33],
    ['crown glass', 1.52],
    ['diamond', 2.42],
    ['acrylic', 1.49],
  ];
  const [name1, n1] = pick(materials);
  let [name2, n2] = pick(materials);
  if (Math.abs(n1 - n2) < 1e-9) {
    // Ensure two distinct media.
    [name2, n2] = n2 === 1.52 ? ['water', 1.33] : ['crown glass', 1.52];
  }
  // Keep incidence safely below the critical angle so a refracted ray exists.
  const tc = criticalAngle(n1, n2);
  const maxDeg = tc !== null ? Math.max(15, Math.floor(radToDeg(tc)) - 5) : 70;
  const theta1Deg = ri(10, Math.min(70, maxDeg));
  const res = refract(n1, n2, degToRad(theta1Deg));
  if (res.theta2 === null) return qSnell(); // defensive: should not happen
  const theta2Deg = radToDeg(res.theta2);
  const bendsToward = theta2Deg < theta1Deg;
  return {
    id: id('snell'),
    simTarget: 'refraction',
    kind: 'numeric',
    prompt: `Light in ${name1} ($n_1 = ${fmt(n1, 2)}$) hits a flat interface with ${name2} ($n_2 = ${fmt(n2, 2)}$) at incidence $\\theta_1 = ${theta1Deg}^\\circ$ (measured from the normal). What is the refraction angle $\\theta_2$ in degrees?`,
    answer: theta2Deg,
    unit: '°',
    tolerancePct: 0.02,
    simParams: { n1, n2, theta1: theta1Deg },
    steps: [
      `**Known:** $n_1 = ${fmt(n1, 2)}$, $n_2 = ${fmt(n2, 2)}$, $\\theta_1 = ${theta1Deg}^\\circ$.`,
      `**Equation:** $n_1\\sin\\theta_1 = n_2\\sin\\theta_2 \\Rightarrow \\theta_2 = \\arcsin\\!\\left(\\frac{n_1}{n_2}\\sin\\theta_1\\right)$.`,
      `**Substitution:** $\\sin\\theta_2 = \\frac{${fmt(n1, 2)}}{${fmt(n2, 2)}}\\sin ${theta1Deg}^\\circ = ${fmt(res.sinTheta2, 4)}$.`,
      `**Calculation:** $\\theta_2 = \\arcsin(${fmt(res.sinTheta2, 4)}) = ${fmt(theta2Deg, 2)}^\\circ$.`,
      `**Check:** $\\sin\\theta_2 \\le 1$, so a propagating refracted ray exists and bends ${bendsToward ? 'toward the normal (entering the optically denser medium)' : 'away from the normal (entering the rarer medium)'}.`,
      `**Speed note:** $v = c/n$: light ${n2 > n1 ? 'slows down' : 'speeds up'} entering medium 2 ($v_2 = ${fmt(lightSpeedInMedium(n2) / 1e8)} \\times 10^8\\ \\mathrm{m/s}$).`,
    ],
  };
}

function qCriticalAngle(): PracticeQuestion {
  const n1 = pick([1.33, 1.5, 1.52, 2.42]);
  const n2 = pick([1.0, 1.33].filter((x) => x < n1));
  const tc = criticalAngle(n1, n2) as number;
  return {
    id: id('critA'),
    simTarget: 'tir',
    kind: 'numeric',
    prompt: `Light travels from a medium with $n_1 = ${fmt(n1, 2)}$ into one with $n_2 = ${fmt(n2, 2)}$. What is the critical angle $\\theta_c$ in degrees?`,
    answer: radToDeg(tc),
    unit: '°',
    tolerancePct: 0.02,
    simParams: { n1, n2, theta1: Math.round(radToDeg(tc)) },
    steps: [
      `**Condition:** TIR requires $n_1 > n_2$: ${fmt(n1, 2)} > ${fmt(n2, 2)} ✓ so a critical angle exists.`,
      `**Equation:** $\\theta_c = \\arcsin(n_2/n_1)$.`,
      `**Substitution:** $\\theta_c = \\arcsin(${fmt(n2, 2)}/${fmt(n1, 2)}) = \\arcsin(${fmt(n2 / n1, 4)})$.`,
      `**Calculation:** $\\theta_c = ${fmt(radToDeg(tc), 2)}^\\circ$.`,
      `**Interpretation:** for $\\theta_1 > ${fmt(radToDeg(tc), 1)}^\\circ$ no refracted ray exists — all light is internally reflected.`,
    ],
  };
}

function qLightSpeed(): PracticeQuestion {
  const n = r2(1.2, 2.4);
  const v = lightSpeedInMedium(n);
  return {
    id: id('cmed'),
    simTarget: 'refraction',
    kind: 'numeric',
    prompt: `A medium has refractive index $n = ${fmt(n, 2)}$. What is the speed of light inside it, expressed in units of $10^8\\ \\mathrm{m/s}$? (Use $c = ${fmt(C_VACUUM / 1e8, 3)} \\times 10^8\\ \\mathrm{m/s}$.)`,
    answer: v / 1e8,
    unit: '×10⁸ m/s',
    tolerancePct: 0.02,
    simParams: { n2: n },
    steps: [
      `**Known:** $n = ${fmt(n, 2)}$, $c = 2.998\\times10^8\\ \\mathrm{m/s}$.`,
      `**Equation:** $n = c/v \\Rightarrow v = c/n$.`,
      `**Substitution:** $v = 2.998\\times10^8 / ${fmt(n, 2)}$.`,
      `**Calculation:** $v = ${fmt(v / 1e8)} \\times 10^8\\ \\mathrm{m/s}$.`,
      `**Interpretation:** light always travels slower in matter than in vacuum; larger $n$ means slower light and stronger bending toward the normal on entry.`,
    ],
  };
}

function qTIRCondition(): PracticeQuestion {
  const { options, correctIndex } = shuffled(
    'Light must go from higher to lower index (n₁ > n₂) with θ₁ > θ_c',
    [
      'Light must go from lower to higher index (n₁ < n₂) with θ₁ > θ_c',
      'It happens at any angle when n₁ = n₂',
      'It happens whenever θ₁ < θ_c in any pair of media',
    ],
  );
  return {
    id: id('tirC'),
    kind: 'mcq',
    prompt: 'Under which condition does total internal reflection occur?',
    options,
    correctIndex,
    steps: [
      '**Requirement 1:** $n_1 > n_2$ — only then can $\\sin\\theta_2 = (n_1/n_2)\\sin\\theta_1$ exceed 1.',
      '**Requirement 2:** $\\theta_1 > \\theta_c = \\arcsin(n_2/n_1)$.',
      `**Example (glass→air):** $\\theta_c = \\arcsin(1/1.5) = ${fmt(radToDeg(criticalAngle(1.5, 1)!), 1)}^\\circ$; at $60^\\circ$ incidence Snell would need $\\sin\\theta_2 = ${fmt(1.5 * Math.sin(degToRad(60)), 3)} > 1$ — impossible, so all light reflects.`,
      '**Counter-example:** air→glass can never totally internally reflect, however grazing the incidence.',
    ],
  };
}

/* ============================ Module F · Chapter 36 ============================ */

function qMirrorImageDistance(): PracticeQuestion {
  const concave = Math.random() < 0.65;
  const R = r1(0.2, 1.2);
  const f = concave ? R / 2 : -R / 2;
  const doVal = concave ? r1(0.15, 3 * R) : r1(0.1, 2);
  if (Math.abs(doVal - f) < 0.02) return qMirrorImageDistance(); // avoid the singular draw
  const img = calculateSphericalMirrorImage(f, doVal, 0.02);
  return {
    id: id('mirD'),
    simTarget: 'spherical',
    kind: 'numeric',
    prompt: `A ${concave ? 'concave' : 'convex'} spherical mirror has radius of curvature $R = ${fmt(R)}\\ \\mathrm{m}$. A real object sits at $d_o = ${fmt(doVal)}\\ \\mathrm{m}$ in front of it. Find the image distance $d_i$ (sign included: positive = front/real side, negative = behind/virtual).`,
    answer: img.imageDistance as number,
    unit: 'm',
    tolerancePct: 0.02,
    simParams: { mirrorType: concave ? 'concave' : 'convex', R, do: doVal },
    steps: [
      `**Known:** ${concave ? 'concave' : 'convex'} mirror, $R = ${fmt(R)}\\ \\mathrm{m}$, $d_o = ${fmt(doVal)}\\ \\mathrm{m}$.`,
      `**Focal length:** $f = ${concave ? '+' : '-'}R/2 = ${fmt(f)}\\ \\mathrm{m}$ (${concave ? 'concave ⇒ f > 0' : 'convex ⇒ f < 0'} in the real-is-positive convention).`,
      `**Equation:** $\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i} \\Rightarrow d_i = \\frac{f\\,d_o}{d_o - f}$.`,
      `**Substitution:** $d_i = \\frac{(${fmt(f)})(${fmt(doVal)})}{${fmt(doVal)} - (${fmt(f)})}$.`,
      `**Calculation:** $d_i = ${fmt(img.imageDistance as number, 4)}\\ \\mathrm{m}$.`,
      `**Magnification:** $m = -d_i/d_o = ${fmt(img.magnification as number, 3)}$.`,
      `**Interpretation:** ${describeSphericalMirrorImage(img)}.`,
    ],
  };
}

function qMirrorClassification(): PracticeQuestion {
  const R = r1(0.3, 1.0);
  const f = R / 2;
  const zone = pick(['beyond', 'between', 'inside'] as const);
  const doVal =
    zone === 'beyond' ? r(2.2 * f, 4 * f) : zone === 'between' ? r(1.15 * f, 1.85 * f) : r(0.2 * f, 0.85 * f);
  const img = calculateSphericalMirrorImage(f, doVal, 0.02);
  const correct = `${img.real ? 'Real' : 'Virtual'}, ${img.upright ? 'upright' : 'inverted'}, ${img.size}`;
  const { options, correctIndex } = shuffled(correct, [
    'Real, inverted, reduced',
    'Virtual, upright, magnified',
    'Real, inverted, magnified',
    'Virtual, upright, reduced',
  ].filter((o) => o !== correct).slice(0, 3));
  return {
    id: id('mirC'),
    simTarget: 'spherical',
    kind: 'mcq',
    prompt: `A concave mirror has $f = ${fmt(f)}\\ \\mathrm{m}$. An object is placed at $d_o = ${fmt(doVal, 2)}\\ \\mathrm{m}$. How is the image classified?`,
    options,
    correctIndex,
    simParams: { mirrorType: 'concave', R, do: Number(doVal.toFixed(3)) },
    steps: [
      `**Equation:** $d_i = \\frac{f d_o}{d_o - f} = \\frac{${fmt(f)}\\cdot${fmt(doVal, 2)}}{${fmt(doVal - f, 3)}} = ${fmt(img.imageDistance as number, 3)}\\ \\mathrm{m}$.`,
      `**Magnification:** $m = -d_i/d_o = ${fmt(img.magnification as number, 3)}$.`,
      `**Signs ⇒ nature:** $d_i ${img.real ? '>' : '<'} 0$ ⇒ ${img.real ? 'real (in front)' : 'virtual (behind)'}; $m ${img.upright ? '>' : '<'} 0$ ⇒ ${img.upright ? 'upright' : 'inverted'}; $|m| = ${fmt(Math.abs(img.magnification as number), 2)}$ ⇒ ${img.size}.`,
      `**Zone:** object is ${zone === 'beyond' ? 'beyond C (d_o > 2f)' : zone === 'between' ? 'between C and F' : 'inside F'} — consistent with the classification above.`,
    ],
  };
}

function qFlatMirrorTF(): PracticeQuestion {
  const d = r1(0.5, 4);
  const statement =
    Math.random() < 0.5
      ? `An object stands ${fmt(d)} m in front of a flat mirror. Its image forms ${fmt(d)} m behind the mirror with magnification +1.`
      : `An object stands ${fmt(d)} m in front of a flat mirror. Its image forms ${fmt(2 * d)} m behind the mirror with magnification −1.`;
  const isTrue = statement.includes('+1');
  return {
    id: id('flatTF'),
    simTarget: 'flat',
    kind: 'tf',
    prompt: `True or false: ${statement}`,
    options: ['True', 'False'],
    correctIndex: isTrue ? 0 : 1,
    simParams: { do: d },
    steps: [
      `**Model:** flat mirror with $d_o = ${fmt(d)}\\ \\mathrm{m}$.`,
      '**Equation:** $d_i = -d_o$ and $m = +1$ (virtual, upright, same size).',
      `**Calculation:** $d_i = ${fmt(-d)}\\ \\mathrm{m}$ — the image lies ${fmt(d)} m *behind* the mirror.`,
      `**Verdict:** the statement is **${isTrue ? 'true' : 'false'}**.`,
    ],
  };
}

/* ================================ Dispatcher ================================ */

const GENERATORS: Record<string, (() => PracticeQuestion)[]> = {
  'oscillatory-motion': [qShmPeriod, qShmEnergy, qShmMassChange, qShmTF],
  'wave-motion': [qStringSpeed, qWaveSpeed, qWavePower, qTensionMCQ],
  interference: [qResultantAmplitude, qHarmonicFrequency, qDestructivePhase, qStandingNodes],
  'ray-optics': [qSnell, qCriticalAngle, qLightSpeed, qTIRCondition],
  'image-formation': [qMirrorImageDistance, qMirrorClassification, qFlatMirrorTF],
};

export function generateQuestion(moduleId: string): PracticeQuestion {
  const pool = GENERATORS[moduleId];
  if (!pool || pool.length === 0) {
    throw new Error(`No question generators registered for module "${moduleId}".`);
  }
  return pick(pool)();
}

export function questionKindsFor(moduleId: string): string[] {
  return (GENERATORS[moduleId] ?? []).map((g) => g().kind);
}
