export interface FormulaVariable {
  sym: string;
  name: string;
  unit: string;
}

export interface FormulaItem {
  id: string;
  moduleId: string;
  sectionRef?: string;
  title: string;
  tex: string;
  variables: FormulaVariable[];
  note?: string;
}

export interface GuidedExperiment {
  id: string;
  title: string;
  objective: string;
  setupLabel: string;
  /** Parameter object applied to the lab via its own validation/clamping. */
  setup: Record<string, number | boolean | string>;
  predictionPrompt: string;
  procedure: string[];
  observe: string;
  conclusionPrompt: string;
}

export interface PredictionScenario<P> {
  id: string;
  /** Description of the change being predicted, e.g. "Double the mass m". */
  changeLabel: string;
  promptTex: string;
  options: { id: string; label: string }[];
  /**
   * Computes before/after values from the real physics functions and
   * determines the correct option — never a hardcoded verdict.
   */
  evaluate: (params: P) => {
    correctOptionId: string;
    explanation: string;
    applyTo?: (params: P) => P;
  };
}

export type QuestionKind = 'mcq' | 'numeric' | 'tf';

export interface PracticeQuestion {
  id: string;
  kind: QuestionKind;
  /** RichText (supports $…$ and $…$ TeX). */
  prompt: string;
  /** For mcq/tf: TeX-capable option strings. */
  options?: string[];
  correctIndex?: number;
  /** For numeric questions. */
  answer?: number;
  /** Relative tolerance for numeric checking (default 0.02 = 2 %). */
  tolerancePct?: number;
  unit?: string;
  /** Worked solution: knowns → equation → substitution → result → check. */
  steps: string[];
  /** Optional configuration to load into the corresponding simulation. */
  simParams?: Record<string, number | boolean | string>;
  /** Lab tab the simParams belong to, e.g. "spring" or "travelling". */
  simTarget?: string;
}
