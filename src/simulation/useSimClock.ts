import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SimClock } from './SimClock';
import type { ClockListener } from './SimClock';

export interface SimClockHandle {
  clock: SimClock;
  running: boolean;
  rate: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  step: (dtSim?: number) => void;
  setTime: (t: number) => void;
  setRate: (rate: number) => void;
}

/**
 * Owns a SimClock for a lab page and mirrors transport status into React
 * state (only for toolbar UI — never for per-frame values).
 */
export function useSimClock(options: { maxTime?: number } = {}): SimClockHandle {
  const clock = useMemo(() => new SimClock(options), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [running, setRunning] = useState(false);
  const [rate, setRateState] = useState(1);

  useEffect(() => () => clock.dispose(), [clock]);

  const play = useCallback(() => {
    clock.play();
    setRunning(true);
  }, [clock]);
  const pause = useCallback(() => {
    clock.pause();
    setRunning(false);
  }, [clock]);
  const toggle = useCallback(() => {
    setRunning(clock.toggle());
  }, [clock]);
  const reset = useCallback(() => {
    clock.reset();
    setRunning(false);
    clock.pause();
  }, [clock]);
  const step = useCallback(
    (dtSim?: number) => {
      clock.step(dtSim);
      setRunning(false);
    },
    [clock],
  );
  const setTime = useCallback((t: number) => clock.setTime(t), [clock]);
  const setRate = useCallback(
    (r: number) => {
      clock.setRate(r);
      setRateState(clock.getRate());
    },
    [clock],
  );

  return { clock, running, rate, play, pause, toggle, reset, step, setTime, setRate };
}

/** Subscribe a stable callback to clock ticks. A null clock is a no-op. */
export function useClockEffect(clock: SimClock | null | undefined, callback: ClockListener): void {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });
  useEffect(() => {
    if (!clock) return;
    return clock.subscribe((t, dt) => cbRef.current(t, dt));
  }, [clock]);
}
