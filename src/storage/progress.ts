/**
 * Learning-progress data: visited modules, quiz performance, formula
 * bookmarks. Completion ("opened") and demonstrated performance ("quiz
 * score") are tracked separately and never conflated.
 */

import { loadJSON, saveJSON } from './local';

export interface QuizRecord {
  correct: number;
  total: number;
  at: number;
}

export interface ProgressData {
  /** moduleId → timestamp of last visit. */
  visited: Record<string, number>;
  /** moduleId → best quiz attempt. */
  quiz: Record<string, QuizRecord>;
  /** Bookmarked formula ids. */
  bookmarks: string[];
}

const KEY = 'progress';

export function isProgressData(v: unknown): v is ProgressData {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  const visitedOk =
    typeof p.visited === 'object' &&
    p.visited !== null &&
    Object.values(p.visited as Record<string, unknown>).every(
      (x) => typeof x === 'number' && Number.isFinite(x),
    );
  const quizOk =
    typeof p.quiz === 'object' &&
    p.quiz !== null &&
    Object.values(p.quiz as Record<string, unknown>).every((x) => {
      if (typeof x !== 'object' || x === null) return false;
      const q = x as Record<string, unknown>;
      return (
        typeof q.correct === 'number' &&
        typeof q.total === 'number' &&
        typeof q.at === 'number'
      );
    });
  const bookmarksOk =
    Array.isArray(p.bookmarks) && p.bookmarks.every((b) => typeof b === 'string');
  return visitedOk && quizOk && bookmarksOk;
}

export const EMPTY_PROGRESS: ProgressData = { visited: {}, quiz: {}, bookmarks: [] };

export function loadProgress(): ProgressData {
  return loadJSON(KEY, isProgressData) ?? { ...EMPTY_PROGRESS, visited: {}, quiz: {}, bookmarks: [] };
}

export function saveProgress(data: ProgressData): { ok: true } | { ok: false; error: string } {
  return saveJSON(KEY, data);
}
