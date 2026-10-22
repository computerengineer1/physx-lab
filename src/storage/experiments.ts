/**
 * Saved experiment configurations (Module workspace "Save experiment" and the
 * My Experiments page). Everything lives in localStorage only — no account,
 * no server, no cross-device sync (and the UI says so).
 */

import { SCHEMA_VERSION, loadJSON, saveJSON } from './local';

export type ParamValue = number | boolean | string;

export interface SavedExperiment {
  schemaVersion: number;
  id: string;
  /** Module id, e.g. "oscillatory-motion". */
  moduleId: string;
  /** Section/tab id inside the module, e.g. "spring". */
  tabId: string;
  name: string;
  params: Record<string, ParamValue>;
  savedAt: number;
}

export function isParamValue(v: unknown): v is ParamValue {
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 200;
  return false;
}

/**
 * Boundary validator: converts an arbitrary lab parameter object into a
 * storable ParamSet. Non-finite numbers, oversized strings and unexpected
 * types (objects, functions) are dropped instead of persisted — no invalid
 * value can ever round-trip back into a simulation.
 */
export function toParamSet(obj: object): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isParamValue(v)) out[k] = v;
  }
  return out;
}

export function isSavedExperiment(v: unknown): v is SavedExperiment {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  if (typeof e.schemaVersion !== 'number') return false;
  if (typeof e.id !== 'string' || e.id.length === 0 || e.id.length > 64) return false;
  if (typeof e.moduleId !== 'string' || e.moduleId.length > 64) return false;
  if (typeof e.tabId !== 'string' || e.tabId.length > 64) return false;
  if (typeof e.name !== 'string' || e.name.length === 0 || e.name.length > 120) return false;
  if (typeof e.savedAt !== 'number' || !Number.isFinite(e.savedAt)) return false;
  if (typeof e.params !== 'object' || e.params === null || Array.isArray(e.params)) return false;
  return Object.values(e.params as Record<string, unknown>).every(isParamValue);
}

/** Tolerates future/unknown schema versions by rejecting them explicitly. */
export function isSavedExperimentList(v: unknown): v is SavedExperiment[] {
  return Array.isArray(v) && v.every(isSavedExperiment);
}

const KEY = 'experiments';

export function listExperiments(): SavedExperiment[] {
  const data = loadJSON(KEY, isSavedExperimentList);
  if (!data) return [];
  // Only keep entries with the current schema version; older ones are
  // reported to the console instead of silently mis-parsed.
  return data.filter((e) => {
    if (e.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[physx] skipping experiment "${e.name}" with schema v${e.schemaVersion}`);
      return false;
    }
    return true;
  });
}

function persist(list: SavedExperiment[]): { ok: true } | { ok: false; error: string } {
  return saveJSON(KEY, list);
}

export function newId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveExperiment(
  input: Omit<SavedExperiment, 'id' | 'savedAt' | 'schemaVersion'>,
): { ok: true; experiment: SavedExperiment } | { ok: false; error: string } {
  const experiment: SavedExperiment = {
    ...input,
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    savedAt: Date.now(),
  };
  const list = [...listExperiments(), experiment];
  const res = persist(list);
  return res.ok ? { ok: true, experiment } : res;
}

export function updateExperimentList(
  next: SavedExperiment[],
): { ok: true } | { ok: false; error: string } {
  return persist(next);
}

export function renameExperiment(
  id: string,
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) {
    return { ok: false, error: 'Name must be 1–120 characters.' };
  }
  const list = listExperiments().map((e) => (e.id === id ? { ...e, name: trimmed } : e));
  return persist(list);
}

export function deleteExperiment(id: string): { ok: true } | { ok: false; error: string } {
  return persist(listExperiments().filter((e) => e.id !== id));
}

export function duplicateExperiment(
  id: string,
): { ok: true; experiment: SavedExperiment } | { ok: false; error: string } {
  const source = listExperiments().find((e) => e.id === id);
  if (!source) return { ok: false, error: 'Experiment not found.' };
  const copy: SavedExperiment = {
    ...source,
    id: newId(),
    name: `${source.name} (copy)`.slice(0, 120),
    savedAt: Date.now(),
  };
  const res = persist([...listExperiments(), copy]);
  return res.ok ? { ok: true, experiment: copy } : res;
}

export function exportExperimentsAsJson(): string {
  return JSON.stringify({ app: 'physx-lab', schemaVersion: SCHEMA_VERSION, experiments: listExperiments() }, null, 2);
}

export interface ImportReport {
  imported: number;
  rejected: { index: number; reason: string }[];
  error?: string;
}

/** Validate an imported file before anything touches storage. No eval, ever. */
export function importExperimentsFromJson(text: string): ImportReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { imported: 0, rejected: [], error: 'File is not valid JSON.' };
  }
  let candidates: unknown[];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as { experiments?: unknown }).experiments)
  ) {
    candidates = (parsed as { experiments: unknown[] }).experiments;
  } else {
    return { imported: 0, rejected: [], error: 'Unrecognized file structure (expected an experiments array).' };
  }

  const existing = listExperiments();
  const importedList: SavedExperiment[] = [];
  const rejected: ImportReport['rejected'] = [];

  candidates.forEach((c, index) => {
    if (!isSavedExperiment(c)) {
      rejected.push({ index, reason: 'Malformed or unsupported entry (schema validation failed).' });
      return;
    }
    if (c.schemaVersion !== SCHEMA_VERSION) {
      rejected.push({ index, reason: `Unsupported schema version ${c.schemaVersion}.` });
      return;
    }
    importedList.push({ ...c, id: newId(), savedAt: Date.now() });
  });

  if (importedList.length > 0) {
    const res = persist([...existing, ...importedList]);
    if (!res.ok) return { imported: 0, rejected, error: res.error };
  }
  return { imported: importedList.length, rejected };
}
