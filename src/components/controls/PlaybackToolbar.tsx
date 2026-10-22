import { useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { SimClockHandle } from '../../simulation/useSimClock';
import { useClockEffect } from '../../simulation/useSimClock';

const RATES = [0.25, 0.5, 1, 2, 4];

/**
 * Transport controls + live simulation-time readout + optional scrubber.
 * The time readout updates imperatively from the clock (no React re-render
 * per frame); React state only changes on play/pause/rate actions.
 */
export function PlaybackToolbar({
  handle,
  showStep = true,
  scrubMax,
  compact = false,
}: {
  handle: SimClockHandle;
  showStep?: boolean;
  /** When finite, shows a time scrubber over [0, scrubMax]. */
  scrubMax?: number;
  compact?: boolean;
}) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  useClockEffect(handle.clock, (t) => {
    if (timeRef.current) timeRef.current.textContent = `${t.toFixed(2)} s`;
    if (scrubRef.current && document.activeElement !== scrubRef.current && Number.isFinite(scrubMax)) {
      scrubRef.current.value = String(Math.min(t, scrubMax ?? t));
    }
  });

  // Keep the scrubber in sync when scrubMax changes.
  useEffect(() => {
    if (scrubRef.current && Number.isFinite(scrubMax)) {
      scrubRef.current.max = String(scrubMax);
    }
  }, [scrubMax]);

  return (
    <div className="panel toolbar" role="group" aria-label="Simulation playback controls">
      <button
        type="button"
        className={`btn primary ${compact ? 'sm' : ''}`}
        onClick={handle.toggle}
        aria-label={handle.running ? 'Pause simulation' : 'Play simulation'}
      >
        {handle.running ? <Pause size={15} /> : <Play size={15} />}
        {handle.running ? 'Pause' : 'Play'}
      </button>
      {showStep && (
        <button
          type="button"
          className={`btn ghost icon-only ${compact ? 'sm' : ''}`}
          onClick={() => handle.step(1 / 30)}
          aria-label="Advance one step (1/30 second of simulation time)"
          title="Single step (+1/30 s)"
        >
          <SkipForward size={15} />
        </button>
      )}
      <button
        type="button"
        className={`btn ghost icon-only ${compact ? 'sm' : ''}`}
        onClick={handle.reset}
        aria-label="Reset simulation time to zero"
        title="Reset (t = 0)"
      >
        <RotateCcw size={15} />
      </button>
      <span className="time-readout" ref={timeRef} aria-label="Simulation time" role="timer">
        0.00 s
      </span>
      {Number.isFinite(scrubMax) && (
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={scrubMax}
          step={scrubMax! / 400}
          defaultValue={0}
          aria-label="Scrub simulation time"
          style={{ flex: 1, minWidth: 120 }}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) handle.setTime(v);
          }}
        />
      )}
      <span className="spacer" />
      <span className="rate-picker" role="group" aria-label="Playback rate">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className="preset-chip"
            aria-pressed={handle.rate === r}
            onClick={() => handle.setRate(r)}
            title={`Playback rate ×${r}`}
          >
            ×{r}
          </button>
        ))}
      </span>
    </div>
  );
}
