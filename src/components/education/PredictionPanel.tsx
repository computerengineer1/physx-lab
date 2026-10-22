import { useMemo, useState } from 'react';
import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react';
import type { PredictionScenario } from '../../education/types';
import { RichText } from '../math/MathTex';

/**
 * Predict → run → compare loop.
 * The verdict is computed from the live parameters through the same physics
 * functions the simulation uses (each scenario's `evaluate`), never canned.
 */
export function PredictionPanel<P>({
  scenarios,
  getParams,
  applyParams,
}: {
  scenarios: PredictionScenario<P>[];
  getParams: () => P;
  applyParams: (params: P) => void;
}) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    explanation: string;
    applyTo?: (p: P) => P;
  } | null>(null);

  const scenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) ?? scenarios[0],
    [scenarios, scenarioId],
  );

  if (!scenario) return <p className="prose">No prediction scenarios for this experiment yet.</p>;

  const run = () => {
    if (!choice) return;
    const evaluated = scenario.evaluate(getParams());
    setResult({
      correct: choice === evaluated.correctOptionId,
      explanation: evaluated.explanation,
      applyTo: evaluated.applyTo,
    });
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`preset-chip ${scenario.id === s.id ? 'active' : ''}`}
            aria-pressed={scenario.id === s.id}
            onClick={() => {
              setScenarioId(s.id);
              setChoice(null);
              setResult(null);
            }}
          >
            {s.changeLabel}
          </button>
        ))}
      </div>
      <p className="prose" style={{ marginTop: 0 }}>
        <RichText text={scenario.promptTex} />
      </p>
      <div role="group" aria-label="Your prediction">
        {scenario.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`quiz-option ${
              result ? (o.id === choice ? (result.correct ? 'correct' : 'wrong') : '') : ''
            }`}
            aria-pressed={choice === o.id}
            onClick={() => {
              setChoice(o.id);
              setResult(null);
            }}
          >
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn primary sm" disabled={!choice} onClick={run}>
          <Lightbulb size={14} /> Apply change &amp; compare
        </button>
        {result?.applyTo && (
          <button
            type="button"
            className="btn sm"
            onClick={() => applyParams(result.applyTo!(getParams()))}
          >
            Load changed setup
          </button>
        )}
      </div>
      {result && (
        <div className={`callout ${result.correct ? 'ok' : 'warn'}`} style={{ marginTop: 10 }} aria-live="polite">
          <b>
            {result.correct ? (
              <>
                <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                Prediction correct.{' '}
              </>
            ) : (
              <>
                <XCircle size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                Not quite.{' '}
              </>
            )}
          </b>
          <RichText text={result.explanation} />
        </div>
      )}
    </div>
  );
}
