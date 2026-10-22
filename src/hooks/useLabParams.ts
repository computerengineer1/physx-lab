import { useCallback, useEffect, useRef, useState } from 'react';
import { takePendingConfig } from '../storage/local';
import { clamp } from '../physics/shared/validation';

export type ParamValue = number | boolean | string;
export type ParamRanges = Record<string, { min: number; max: number } | undefined>;

/**
 * Parameter state for one lab:
 *  - typed defaults + numeric ranges used to validate/clamp every external
 *    write (presets, saved configs, guided experiments, practice hand-offs);
 *  - consumes a pending configuration staged in sessionStorage so "Load in
 *    simulation" works across routes;
 *  - setParam for sliders/inputs (already constrained by their min/max).
 */
export function useLabParams<T extends object>(
  moduleId: string,
  tabId: string,
  defaults: T,
  ranges: ParamRanges = {},
): {
  params: T;
  setParam: <K extends keyof T & string>(key: K, value: T[K]) => void;
  /** Applies any subset of known keys; values are validated & clamped. */
  applyParams: (incoming: object) => void;
  resetParams: () => void;
} {
  const [params, setParams] = useState<T>(defaults);
  const rangesRef = useRef(ranges);
  useEffect(() => {
    rangesRef.current = ranges;
  });

  const applyParams = useCallback((incoming: object) => {
    setParams((prev) => {
      const cur = prev as Record<string, unknown>;
      const next: Record<string, unknown> = { ...cur };
      let changed = false;
      for (const [key, raw] of Object.entries(incoming as Record<string, unknown>)) {
        if (!(key in cur)) continue;
        const current = cur[key];
        if (typeof current === 'number') {
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isFinite(n)) continue; // reject NaN/Infinity at the boundary
          const range = rangesRef.current[key];
          next[key] = range ? clamp(n, range.min, range.max) : n;
          changed = true;
        } else if (typeof current === 'boolean' && typeof raw === 'boolean') {
          next[key] = raw;
          changed = true;
        } else if (typeof current === 'string' && typeof raw === 'string' && raw.length <= 64) {
          next[key] = raw;
          changed = true;
        }
      }
      return changed ? (next as T) : prev;
    });
  }, []);

  // Cross-page hand-off (practice questions, guided experiments).
  useEffect(() => {
    const pending = takePendingConfig(`${moduleId}:${tabId}`);
    if (pending) applyParams(pending);
  }, [moduleId, tabId, applyParams]);

  const setParam = useCallback(<K extends keyof T & string>(key: K, value: T[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetParams = useCallback(() => setParams(defaults), [defaults]);

  return { params, setParam, applyParams, resetParams };
}
