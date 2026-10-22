import type { ReactNode } from 'react';
import type { SimClock } from '../../simulation/SimClock';
import { LiveValue } from './LiveValue';

export interface Measurement {
  label: string;
  unit?: string;
  /** Either a static value or a live function of simulation time. */
  value?: string;
  live?: (t: number) => string;
  tone?: 'accent' | 'amber' | 'violet' | 'red' | 'green';
  title?: string;
}

/**
 * Grid of numeric readouts. Every value shown here comes from the actual
 * model — static ones are computed by the lab from current parameters,
 * live ones are functions of the simulation clock.
 */
export function Measurements({
  items,
  clock,
  title = 'Live measurements',
}: {
  items: Measurement[];
  clock?: SimClock;
  title?: ReactNode;
}) {
  return (
    <div aria-label={typeof title === 'string' ? title : undefined}>
      <div className="measure-grid" aria-live="off">
        {items.map((m) => (
          <div className={`measure ${m.tone ?? ''}`} key={m.label} title={m.title ?? m.label}>
            <div className="m-label">{m.label}</div>
            <div className="m-value">
              {m.live && clock ? (
                <LiveValue clock={clock} compute={m.live} />
              ) : (
                <span>{m.value ?? '—'}</span>
              )}
              {m.unit && <span className="m-unit">{m.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
