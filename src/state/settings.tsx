import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadJSON, saveJSON } from '../storage/local';

export interface AppSettings {
  theme: 'dark' | 'light';
  /** Disable decorative transitions/animations (simulations still animate). */
  reducedMotion: boolean;
  /** Lower rendering quality: capped DPR, no shadows, demand-based 3D. */
  lowEffects: boolean;
}

const DEFAULTS: AppSettings = { theme: 'dark', reducedMotion: false, lowEffects: false };

function isAppSettings(v: unknown): v is AppSettings {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    (s.theme === 'dark' || s.theme === 'light') &&
    typeof s.reducedMotion === 'boolean' &&
    typeof s.lowEffects === 'boolean'
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  setTheme: (theme: AppSettings['theme']) => void;
  setReducedMotion: (on: boolean) => void;
  setLowEffects: (on: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadJSON('settings', isAppSettings);
    return stored ?? { ...DEFAULTS, reducedMotion: prefersReducedMotion() };
  });

  useEffect(() => {
    const res = saveJSON('settings', settings);
    if (!res.ok) console.warn('[physx] settings not persisted:', res.error);
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    document.documentElement.classList.toggle('low-effects', settings.lowEffects);
  }, [settings]);

  const setTheme = useCallback(
    (theme: AppSettings['theme']) => setSettings((s) => ({ ...s, theme })),
    [],
  );
  const setReducedMotion = useCallback(
    (reducedMotion: boolean) => setSettings((s) => ({ ...s, reducedMotion })),
    [],
  );
  const setLowEffects = useCallback(
    (lowEffects: boolean) => setSettings((s) => ({ ...s, lowEffects })),
    [],
  );

  const value = useMemo(
    () => ({ settings, setTheme, setReducedMotion, setLowEffects }),
    [settings, setTheme, setReducedMotion, setLowEffects],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
