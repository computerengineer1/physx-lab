import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Lazy lab registry — each syllabus section maps to a real lab component.
 * Code-split so only the opened laboratory is downloaded; no placeholder
 * pages exist in this map.
 */
export const LAB_REGISTRY: Record<string, Record<string, LazyExoticComponent<ComponentType>>> = {
  'oscillatory-motion': {
    spring: lazy(() => import('./oscillatory-motion/SpringMassLab')),
    shm: lazy(() => import('./oscillatory-motion/ShmAnalysisLab')),
    energy: lazy(() => import('./oscillatory-motion/EnergyLab')),
    circular: lazy(() => import('./oscillatory-motion/CircularMotionLab')),
  },
  'wave-motion': {
    pulse: lazy(() => import('./wave-motion/PulseLab')),
    travelling: lazy(() => import('./wave-motion/TravellingWaveLab')),
    'string-speed': lazy(() => import('./wave-motion/StringSpeedLab')),
    power: lazy(() => import('./wave-motion/WavePowerLab')),
  },
  interference: {
    superposition: lazy(() => import('./interference/SuperpositionLab')),
    standing: lazy(() => import('./interference/StandingWaveLab')),
    harmonics: lazy(() => import('./interference/HarmonicsLab')),
  },
  'ray-optics': {
    reflection: lazy(() => import('./ray-optics/ReflectionLab')),
    refraction: lazy(() => import('./ray-optics/RefractionLab')),
    tir: lazy(() => import('./ray-optics/TotalInternalReflectionLab')),
  },
  'image-formation': {
    flat: lazy(() => import('./image-formation/FlatMirrorLab')),
    spherical: lazy(() => import('./image-formation/SphericalMirrorLab')),
  },
};
