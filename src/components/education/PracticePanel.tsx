import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import type { PracticeQuestion } from '../../education/types';
import { useAppData } from '../../state/data';
import { RichText } from '../math/MathTex';
import { InlineError } from '../ui/primitives';

interface SessionState {
  question: PracticeQuestion;
  selected: number | null;
  numericDraft: string;
  checked: boolean;
  wasCorrect: boolean;
  showSteps: boolean;
}

/**
 * Practice mode: original questions generated from the same validated
 * physics functions used by the simulations. Randomized within valid
 * ranges; the stored answer always carries the data needed to verify it
 * (worked solution steps with substituted numbers and a unit check).
 */
export function PracticePanel({
  moduleId,
  generate,
  onLoadToSim,
}: {
  moduleId: string;
  generate: () => PracticeQuestion;
  onLoadToSim?: (params: Record<string, number | boolean | string>, simTarget?: string) => void;
}) {
  const { recordQuiz } = useAppData();
  const [session, setSession] = useState<SessionState>(() => ({
    question: generate(),
    selected: null,
    numericDraft: '',
    checked: false,
    wasCorrect: false,
    showSteps: false,
  }));
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [inputError, setInputError] = useState<string | null>(null);

  // Keep the generator fresh without re-rolling the current question.
  const genRef = useCallback(() => generate(), [generate]);
  useEffect(() => {
    // no-op; generate is called on demand only
  }, [genRef]);

  const next = () => {
    setSession({
      question: generate(),
      selected: null,
      numericDraft: '',
      checked: false,
      wasCorrect: false,
      showSteps: false,
    });
    setInputError(null);
  };

  const check = () => {
    const q = session.question;
    let correct = false;
    if (q.kind === 'numeric') {
      const parsed = Number(session.numericDraft.trim().replace(/,/g, '.'));
      if (session.numericDraft.trim() === '' || !Number.isFinite(parsed)) {
        setInputError('Enter a finite numeric answer.');
        return;
      }
      setInputError(null);
      const tol = (q.tolerancePct ?? 0.02) * Math.max(Math.abs(q.answer ?? 1), 1e-12);
      correct = Math.abs(parsed - (q.answer ?? NaN)) <= tol;
    } else {
      if (session.selected === null) {
        setInputError('Choose an option first.');
        return;
      }
      setInputError(null);
      correct = session.selected === q.correctIndex;
    }
    setSession((s) => ({ ...s, checked: true, wasCorrect: correct }));
    const nextScore = { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 };
    setScore(nextScore);
    recordQuiz(moduleId, { ...nextScore, at: Date.now() });
  };

  const q = session.question;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="badge">
          {q.kind === 'mcq' ? 'Multiple choice' : q.kind === 'tf' ? 'True / false' : 'Numerical'}
        </span>
        <span className="badge green" aria-label={`Session score: ${score.correct} of ${score.total} correct`}>
          Score {score.correct}/{score.total}
        </span>
      </div>

      <p className="prose" style={{ marginTop: 0 }}>
        <RichText text={q.prompt} />
      </p>

      {q.kind === 'numeric' ? (
        <div className="answer-input-row">
          <input
            className="num-input"
            style={{ width: 140 }}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="Your numeric answer"
            value={session.numericDraft}
            disabled={session.checked}
            onChange={(e) => {
              setSession((s) => ({ ...s, numericDraft: e.target.value }));
              setInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !session.checked) check();
            }}
          />
          {q.unit && <span className="unit-tag">{q.unit}</span>}
          <span className="unit-tag">±{Math.round((q.tolerancePct ?? 0.02) * 100)}% accepted</span>
        </div>
      ) : (
        <div role="group" aria-label="Answer options">
          {(q.options ?? []).map((opt, i) => {
            let cls = 'quiz-option';
            if (session.checked) {
              if (i === q.correctIndex) cls += ' correct';
              else if (i === session.selected) cls += ' wrong';
            }
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={session.checked}
                aria-pressed={session.selected === i}
                onClick={() => {
                  setSession((s) => ({ ...s, selected: i }));
                  setInputError(null);
                }}
              >
                <span className="opt-key">{String.fromCharCode(65 + i)}.</span>
                <span>
                  <RichText text={opt} />
                </span>
                {session.checked && i === q.correctIndex && (
                  <CheckCircle2 size={15} style={{ color: 'var(--green)', marginLeft: 'auto' }} />
                )}
                {session.checked && i === session.selected && i !== q.correctIndex && (
                  <XCircle size={15} style={{ color: 'var(--red)', marginLeft: 'auto' }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {inputError && <InlineError>{inputError}</InlineError>}

      <div className="row" style={{ marginTop: 10 }}>
        {!session.checked ? (
          <button type="button" className="btn primary sm" onClick={check}>
            <CheckCircle2 size={14} /> Check answer
          </button>
        ) : (
          <span
            className={`badge ${session.wasCorrect ? 'green' : 'red'}`}
            role="status"
          >
            {session.wasCorrect ? '✓ Correct' : '✗ Not correct'}
            {q.kind === 'numeric' && !session.wasCorrect && q.answer !== undefined && (
              <> — expected ≈ {Number(q.answer.toPrecision(3)).toString()} {q.unit ?? ''}</>
            )}
          </span>
        )}
        <button
          type="button"
          className="btn sm"
          onClick={() => setSession((s) => ({ ...s, showSteps: !s.showSteps }))}
          aria-expanded={session.showSteps}
        >
          {session.showSteps ? 'Hide worked solution' : 'Show worked solution'}
        </button>
        <button type="button" className="btn ghost sm" onClick={next}>
          <RefreshCw size={13} /> New question
        </button>
        {q.simParams && onLoadToSim && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onLoadToSim(q.simParams!, q.simTarget)}
          >
            <ExternalLink size={13} /> Load in simulation
          </button>
        )}
      </div>

      {session.showSteps && (
        <div className="callout" style={{ marginTop: 12 }}>
          <b>Worked solution</b>
          <ol className="prose" style={{ margin: '6px 0 0', paddingLeft: '1.3em' }}>
            {q.steps.map((step, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <RichText text={step} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
