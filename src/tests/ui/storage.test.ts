import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteExperiment,
  duplicateExperiment,
  exportExperimentsAsJson,
  importExperimentsFromJson,
  isSavedExperiment,
  listExperiments,
  renameExperiment,
  saveExperiment,
  toParamSet,
} from '../../storage/experiments';
import { clearAllData, loadJSON, saveJSON, setPendingConfig, takePendingConfig } from '../../storage/local';
import { isProgressData, loadProgress, saveProgress } from '../../storage/progress';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('saved experiments storage', () => {
  it('saves, lists and round-trips a configuration', () => {
    const res = saveExperiment({
      moduleId: 'oscillatory-motion',
      tabId: 'spring',
      name: 'My setup',
      params: { m: 1.5, k: 40, showVectors: true, mode: 'free' },
    });
    expect(res.ok).toBe(true);
    const list = listExperiments();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('My setup');
    expect(list[0].params.m).toBe(1.5);
    expect(list[0].params.showVectors).toBe(true);
  });

  it('renames, duplicates and deletes', () => {
    const res = saveExperiment({ moduleId: 'wave-motion', tabId: 'travelling', name: 'A', params: { freq: 2 } });
    if (!res.ok) throw new Error('save failed');
    const id = res.experiment.id;

    expect(renameExperiment(id, 'Renamed').ok).toBe(true);
    expect(listExperiments()[0].name).toBe('Renamed');
    expect(renameExperiment(id, '').ok).toBe(false);

    const dup = duplicateExperiment(id);
    expect(dup.ok).toBe(true);
    expect(listExperiments()).toHaveLength(2);

    expect(deleteExperiment(id).ok).toBe(true);
    expect(listExperiments()).toHaveLength(1);
    expect(listExperiments()[0].name).toContain('(copy)');
  });

  it('toParamSet drops non-finite numbers and non-primitives', () => {
    const out = toParamSet({
      good: 1.5,
      nan: NaN,
      inf: Infinity,
      bool: false,
      str: 'ok',
      fn: () => 1,
      obj: { a: 1 },
    });
    expect(out).toEqual({ good: 1.5, bool: false, str: 'ok' });
  });

  it('import validates structure and reports rejections honestly', () => {
    expect(importExperimentsFromJson('not json').error).toMatch(/not valid JSON/i);
    expect(importExperimentsFromJson('{"foo": 1}').error).toMatch(/Unrecognized/i);

    const good = {
      schemaVersion: 1,
      id: 'x1',
      moduleId: 'interference',
      tabId: 'standing',
      name: 'Imported',
      params: { A: 0.05 },
      savedAt: Date.now(),
    };
    const badSchema = { ...good, schemaVersion: 99, name: 'Future' };
    const malformed = { name: 42 };
    const report = importExperimentsFromJson(
      JSON.stringify({ experiments: [good, badSchema, malformed] }),
    );
    expect(report.error).toBeUndefined();
    expect(report.imported).toBe(1);
    expect(report.rejected).toHaveLength(2);
    expect(listExperiments().some((e) => e.name === 'Imported')).toBe(true);
    expect(listExperiments().some((e) => e.name === 'Future')).toBe(false);
  });

  it('export produces re-importable JSON', () => {
    saveExperiment({ moduleId: 'ray-optics', tabId: 'refraction', name: 'Bench', params: { n1: 1, n2: 1.5 } });
    const json = exportExperimentsAsJson();
    window.localStorage.clear();
    expect(listExperiments()).toHaveLength(0);
    const report = importExperimentsFromJson(json);
    expect(report.imported).toBe(1);
    expect(listExperiments()[0].name).toBe('Bench');
  });

  it('isSavedExperiment rejects entries with non-finite params', () => {
    expect(
      isSavedExperiment({
        schemaVersion: 1,
        id: 'a',
        moduleId: 'm',
        tabId: 't',
        name: 'n',
        params: { x: NaN },
        savedAt: 1,
      }),
    ).toBe(false);
  });
});

describe('local storage wrapper', () => {
  it('returns null for malformed stored JSON instead of throwing', () => {
    window.localStorage.setItem('physx:broken', '{{{');
    expect(loadJSON('broken', (v): v is object => typeof v === 'object' && v !== null)).toBeNull();
  });

  it('returns null when validation fails', () => {
    saveJSON('thing', { a: 1 });
    expect(loadJSON('thing', (v): v is { b: number } => typeof v === 'object' && v !== null && 'b' in v)).toBeNull();
  });

  it('pending config hand-off is consumed exactly once', () => {
    setPendingConfig('oscillatory-motion:spring', { m: 2 });
    const first = takePendingConfig('oscillatory-motion:spring');
    expect(first).toEqual({ m: 2 });
    expect(takePendingConfig('oscillatory-motion:spring')).toBeNull();
    expect(takePendingConfig('other:tab')).toBeNull();
  });
});

describe('progress storage', () => {
  it('validates shape and round-trips', () => {
    expect(isProgressData({ visited: { a: 'x' }, quiz: {}, bookmarks: [] })).toBe(false);
    expect(isProgressData({ visited: {}, quiz: {}, bookmarks: ['f1'] })).toBe(true);
    saveProgress({ visited: { 'wave-motion': 123 }, quiz: { 'wave-motion': { correct: 3, total: 4, at: 123 } }, bookmarks: ['snell'] });
    const p = loadProgress();
    expect(p.visited['wave-motion']).toBe(123);
    expect(p.quiz['wave-motion'].correct).toBe(3);
    expect(p.bookmarks).toEqual(['snell']);
    clearAllData();
    expect(loadProgress().bookmarks).toEqual([]);
  });
});
