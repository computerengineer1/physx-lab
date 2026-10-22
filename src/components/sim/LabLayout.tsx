import type { ReactNode } from 'react';
import { Accordion } from '../ui/primitives';

export interface LabLayoutProps {
  /** The main visualization (Scene3D wrapper, SVG bench, canvas). */
  scene: ReactNode;
  toolbar?: ReactNode;
  /** Live measurement strip rendered under the toolbar. */
  measurements?: ReactNode;
  charts?: ReactNode;
  controls?: ReactNode;
  model?: ReactNode;
  equations?: ReactNode;
  prediction?: ReactNode;
  investigations?: ReactNode;
  practice?: ReactNode;
  /** Save/export/preset actions shown at the top of the Controls panel. */
  actions?: ReactNode;
}

/**
 * Reusable simulation workspace: large scene + transport + measurements on
 * the left, collapsible parameter/learning panels on the right. On narrow
 * screens the side panels flow below the scene (CSS handles the switch).
 */
export function LabLayout({
  scene,
  toolbar,
  measurements,
  charts,
  controls,
  model,
  equations,
  prediction,
  investigations,
  practice,
  actions,
}: LabLayoutProps) {
  return (
    <div className="lab-grid">
      <div className="lab-main">
        <div className="stack" style={{ gap: 10 }}>
          {scene}
          {toolbar}
        </div>
        {measurements && (
          <div className="panel" aria-label="Live measurements">
            {measurements}
          </div>
        )}
        {charts}
      </div>
      <aside className="lab-side" aria-label="Experiment panels">
        {controls && (
          <Accordion title="Parameters" defaultOpen>
            {actions && <div className="row" style={{ marginBottom: 12 }}>{actions}</div>}
            {controls}
          </Accordion>
        )}
        {model && <Accordion title="Physical model">{model}</Accordion>}
        {equations && <Accordion title="Equations" defaultOpen>{equations}</Accordion>}
        {prediction && <Accordion title="Predict">{prediction}</Accordion>}
        {investigations && <Accordion title="Investigate">{investigations}</Accordion>}
        {practice && <Accordion title="Practice">{practice}</Accordion>}
      </aside>
    </div>
  );
}
