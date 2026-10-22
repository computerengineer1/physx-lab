/**
 * Safe localStorage wrapper.
 *
 * All persisted data is versioned and validated on read. Missing storage
 * (private mode / disabled), quota errors and malformed JSON are handled
 * explicitly — a failed read returns null, a failed write returns an error
 * the UI can surface. No secret data is ever stored here.
 */

const PREFIX = 'physx:';

export const SCHEMA_VERSION = 1;

let availability: boolean | null = null;

export function isStorageAvailable(): boolean {
  if (availability !== null) return availability;
  try {
    const probeKey = `${PREFIX}__probe__`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

export function loadJSON<T>(key: string, validate: (value: unknown) => value is T): T | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validate(parsed)) {
      console.warn(`[physx] stored value for "${key}" failed validation; ignoring it.`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(`[physx] could not read "${key}":`, err);
    return null;
  }
}

export function saveJSON(key: string, value: unknown): { ok: true } | { ok: false; error: string } {
  if (!isStorageAvailable()) {
    return { ok: false, error: 'Browser storage is unavailable (private mode?).' };
  }
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)
        ? 'Browser storage is full. Delete some saved experiments.'
        : 'Could not write to browser storage.';
    console.warn(`[physx] could not save "${key}":`, err);
    return { ok: false, error: message };
  }
}

export function removeKey(key: string): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn(`[physx] could not remove "${key}":`, err);
  }
}

export function listKeys(): string[] {
  if (!isStorageAvailable()) return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
  }
  return keys;
}

/** Approximate storage usage of PHYSX LAB data, in bytes. */
export function usageBytes(): number {
  if (!isStorageAvailable()) return 0;
  let total = 0;
  for (const key of listKeys()) {
    total += (window.localStorage.getItem(PREFIX + key) ?? '').length * 2;
  }
  return total;
}

export function clearAllData(): void {
  if (!isStorageAvailable()) return;
  for (const key of listKeys()) {
    window.localStorage.removeItem(PREFIX + key);
  }
}

/** sessionStorage-based hand-off for "load this configuration into the lab". */
export function setPendingConfig(target: string, params: Record<string, unknown>): void {
  try {
    window.sessionStorage.setItem(`${PREFIX}pending:${target}`, JSON.stringify(params));
  } catch (err) {
    console.warn('[physx] could not stage pending config:', err);
  }
}

export function takePendingConfig(target: string): Record<string, unknown> | null {
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}pending:${target}`);
    if (!raw) return null;
    window.sessionStorage.removeItem(`${PREFIX}pending:${target}`);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
