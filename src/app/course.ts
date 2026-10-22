import type { LucideIcon } from 'lucide-react';
import { Activity, Aperture, Layers, Sigma, Sun, Waves } from 'lucide-react';

export interface CourseSection {
  id: string;
  /** Student-friendly label. */
  label: string;
  /** Syllabus section identifier, e.g. "§15.1". Omitted for review tabs. */
  syllabusRef?: string;
  path: string;
}

export interface CourseModule {
  id: string;
  title: string;
  shortTitle: string;
  chapter: string;
  route: string;
  color: string;
  icon: LucideIcon;
  description: string;
  clo?: { id: string; text: string };
  sections: CourseSection[];
  /** True for supporting material not tied to a numbered syllabus chapter. */
  isSupporting?: boolean;
}

export const COURSE = {
  institution: 'Lebanese International University (LIU)',
  title: 'Physics for Engineers',
  code: 'PHYS220',
  semester: 'Fall 2026–2027',
  credits: 3,
} as const;

export const MODULES: CourseModule[] = [
  {
    id: 'math-review',
    title: 'Mathematical Revision',
    shortTitle: 'Math Toolkit',
    chapter: 'Module A · Mathematical revision',
    route: '/math-review',
    color: '#94a3b8',
    icon: Sigma,
    description:
      'Supporting study tools for the mathematics the syllabus revises before Chapter 15: radians, sinusoids, graphs, units, dimensional consistency and calculus ideas used to interpret motion and waves.',
    isSupporting: true,
    sections: [
      { id: 'radians', label: 'Radians & the unit circle', path: 'radians' },
      { id: 'sinusoids', label: 'Sinusoidal functions', path: 'sinusoids' },
      { id: 'units', label: 'Units & dimensions', path: 'units' },
      { id: 'notation', label: 'Scientific notation', path: 'notation' },
      { id: 'calculus', label: 'Calculus for motion', path: 'calculus' },
    ],
  },
  {
    id: 'oscillatory-motion',
    title: 'Oscillatory Motion',
    shortTitle: 'Oscillations',
    chapter: 'Module B · Chapter 15',
    route: '/oscillatory-motion',
    color: '#22d3ee',
    icon: Activity,
    description:
      'Spring–mass systems and simple harmonic motion: the force law, the sinusoidal solution, energy exchange, and the deep link with uniform circular motion.',
    clo: {
      id: 'CLO-1',
      text: 'Understand simple harmonic motion and describe it using Newton’s second law and energy conservation.',
    },
    sections: [
      { id: 'spring', label: 'Spring & mass', syllabusRef: '§15.1', path: 'spring' },
      { id: 'shm', label: 'SHM analysis', syllabusRef: '§15.2', path: 'shm' },
      { id: 'energy', label: 'Energy of the oscillator', syllabusRef: '§15.3', path: 'energy' },
      { id: 'circular', label: 'SHM ↔ circular motion', syllabusRef: '§15.4', path: 'circular' },
      { id: 'review', label: 'Ch. 15 review & practice', path: 'review' },
    ],
  },
  {
    id: 'wave-motion',
    title: 'Wave Motion',
    shortTitle: 'Waves',
    chapter: 'Module C · Chapter 16',
    route: '/wave-motion',
    color: '#5b8cff',
    icon: Waves,
    description:
      'How disturbances propagate: travelling sinusoidal waves, the wave function, wave speed on stretched strings, and the rate of energy transfer.',
    clo: {
      id: 'CLO-2',
      text: 'Identify the features of a propagating wave and write expressions for its wave function, speed, and energy.',
    },
    sections: [
      { id: 'pulse', label: 'Propagation of a disturbance', syllabusRef: '§16.1', path: 'pulse' },
      { id: 'travelling', label: 'Travelling wave', syllabusRef: '§16.2', path: 'travelling' },
      { id: 'string-speed', label: 'Speed of waves on strings', syllabusRef: '§16.3', path: 'string-speed' },
      { id: 'power', label: 'Energy transfer rate', syllabusRef: '§16.4', path: 'power' },
      { id: 'review', label: 'Ch. 16 review & practice', path: 'review' },
    ],
  },
  {
    id: 'interference',
    title: 'Superposition & Standing Waves',
    shortTitle: 'Superposition',
    chapter: 'Module D · Chapter 18',
    route: '/interference',
    color: '#a78bfa',
    icon: Layers,
    description:
      'Adding waves: interference of co-propagating sinusoids, standing-wave patterns, and the boundary conditions that quantize a vibrating string.',
    clo: {
      id: 'CLO-3',
      text: 'Apply the superposition principle to waves traveling in the same direction and to standing waves.',
    },
    sections: [
      { id: 'superposition', label: 'Waves in interference', syllabusRef: '§18.1', path: 'superposition' },
      { id: 'standing', label: 'Standing waves', syllabusRef: '§18.2', path: 'standing' },
      {
        id: 'harmonics',
        label: 'Boundary conditions & harmonics',
        syllabusRef: '§18.4',
        path: 'harmonics',
      },
      { id: 'review', label: 'Ch. 18 review & practice', path: 'review' },
    ],
  },
  {
    id: 'ray-optics',
    title: 'The Nature of Light & Ray Optics',
    shortTitle: 'Ray Optics',
    chapter: 'Module E · Chapter 35',
    route: '/ray-optics',
    color: '#fbbf24',
    icon: Sun,
    description:
      'Ray models of light: the law of reflection, Snell’s law of refraction, and total internal reflection with the critical angle.',
    clo: {
      id: 'CLO-4',
      text: 'Use the laws of ray optics to understand light reflection, refraction, and total internal reflection.',
    },
    sections: [
      { id: 'reflection', label: 'Reflection', syllabusRef: '§35.4', path: 'reflection' },
      { id: 'refraction', label: 'Refraction', syllabusRef: '§35.5', path: 'refraction' },
      { id: 'tir', label: 'Total internal reflection', syllabusRef: '§35.8', path: 'tir' },
      { id: 'review', label: 'Ch. 35 review & practice', path: 'review' },
    ],
  },
  {
    id: 'image-formation',
    title: 'Image Formation',
    shortTitle: 'Mirrors',
    chapter: 'Module F · Chapter 36',
    route: '/image-formation',
    color: '#f87171',
    icon: Aperture,
    description:
      'Locating images mathematically and graphically: flat mirrors, and concave/convex spherical mirrors with principal-ray construction.',
    clo: {
      id: 'CLO-5',
      text: 'Locate images mathematically and graphically, and describe their nature and characteristics for spherical mirrors.',
    },
    sections: [
      { id: 'flat', label: 'Flat mirrors', syllabusRef: '§36.1', path: 'flat' },
      { id: 'spherical', label: 'Spherical mirrors', syllabusRef: '§36.2', path: 'spherical' },
      { id: 'review', label: 'Ch. 36 review & practice', path: 'review' },
    ],
  },
];

export function getModule(id: string): CourseModule | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getAllSections(): { module: CourseModule; section: CourseSection }[] {
  return MODULES.flatMap((m) => m.sections.map((s) => ({ module: m, section: s })));
}
