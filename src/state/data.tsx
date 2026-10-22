import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadProgress, saveProgress } from '../storage/progress';
import type { ProgressData, QuizRecord } from '../storage/progress';

interface DataContextValue {
  progress: ProgressData;
  markVisited: (moduleId: string) => void;
  recordQuiz: (moduleId: string, record: QuizRecord) => void;
  toggleBookmark: (formulaId: string) => void;
  isBookmarked: (formulaId: string) => boolean;
  recentModules: { moduleId: string; at: number }[];
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress());

  const markVisited = useCallback(
    (moduleId: string) => {
      setProgress((prev) => {
        if (prev.visited[moduleId] && Date.now() - prev.visited[moduleId] < 60_000) {
          return prev; // avoid write storms on rapid re-renders
        }
        const next = { ...prev, visited: { ...prev.visited, [moduleId]: Date.now() } };
        const res = saveProgress(next);
        if (!res.ok) console.warn('[physx] progress not persisted:', res.error);
        return next;
      });
    },
    [],
  );

  const recordQuiz = useCallback(
    (moduleId: string, record: QuizRecord) => {
      setProgress((prev) => {
        const best = prev.quiz[moduleId];
        const better =
          !best ||
          record.correct / Math.max(1, record.total) > best.correct / Math.max(1, best.total);
        const next = {
          ...prev,
          quiz: { ...prev.quiz, [moduleId]: better ? record : best },
        };
        const res = saveProgress(next);
        if (!res.ok) console.warn('[physx] progress not persisted:', res.error);
        return next;
      });
    },
    [],
  );

  const toggleBookmark = useCallback(
    (formulaId: string) => {
      setProgress((prev) => {
        const has = prev.bookmarks.includes(formulaId);
        const next = {
          ...prev,
          bookmarks: has
            ? prev.bookmarks.filter((b) => b !== formulaId)
            : [...prev.bookmarks, formulaId],
        };
        const res = saveProgress(next);
        if (!res.ok) console.warn('[physx] progress not persisted:', res.error);
        return next;
      });
    },
    [],
  );

  const value = useMemo<DataContextValue>(() => {
    const recentModules = Object.entries(progress.visited)
      .map(([moduleId, at]) => ({ moduleId, at }))
      .sort((a, b) => b.at - a.at);
    return {
      progress,
      markVisited,
      recordQuiz,
      toggleBookmark,
      isBookmarked: (id: string) => progress.bookmarks.includes(id),
      recentModules,
    };
  }, [progress, markVisited, recordQuiz, toggleBookmark]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used inside <DataProvider>');
  return ctx;
}
