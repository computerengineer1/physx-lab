import { useEffect, useRef } from 'react';
import type { SimClock } from '../../simulation/SimClock';
import { useClockEffect } from '../../simulation/useSimClock';

/**
 * A live numeric readout driven directly by the simulation clock.
 * Updates its text imperatively — zero React re-renders per frame.
 */
export function LiveValue({
  clock,
  compute,
  className,
  as: Tag = 'span',
}: {
  clock: SimClock;
  compute: (t: number) => string;
  className?: string;
  as?: 'span' | 'b' | 'div';
}) {
  const ref = useRef<HTMLElement>(null);
  useClockEffect(clock, (t) => {
    if (ref.current) ref.current.textContent = compute(t);
  });
  useEffect(() => {
    if (ref.current) ref.current.textContent = compute(clock.getTime());
  }, [clock, compute]);
  return <Tag ref={ref as never} className={className}>{compute(clock.getTime())}</Tag>;
}
