import { FlaskConical, Play } from 'lucide-react';
import type { GuidedExperiment } from '../../education/types';

/**
 * Guided investigations. "Load setup" applies the experiment's parameter
 * object through the lab's own setter, so the real simulation state changes.
 */
export function GuidedPanel({
  experiments,
  onLoad,
}: {
  experiments: GuidedExperiment[];
  onLoad: (setup: Record<string, number | boolean | string>) => void;
}) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {experiments.map((g, idx) => (
        <details key={g.id} className="accordion" open={idx === 0}>
          <summary
            className="accordion-header"
            style={{ listStyle: 'none', cursor: 'pointer' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={15} style={{ color: 'var(--cyan)' }} />
              {g.title}
            </span>
          </summary>
          <div className="accordion-body prose">
            <p>
              <b>Objective.</b> {g.objective}
            </p>
            <p>
              <b>Initial configuration.</b> {g.setupLabel}{' '}
              <button type="button" className="btn sm" onClick={() => onLoad(g.setup)}>
                <Play size={13} /> Load setup
              </button>
            </p>
            <p>
              <b>Predict first.</b> {g.predictionPrompt}
            </p>
            <p>
              <b>Procedure.</b>
            </p>
            <ol>
              {g.procedure.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <b>Record.</b> {g.observe}
            </p>
            <p>
              <b>Conclude.</b> {g.conclusionPrompt}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
