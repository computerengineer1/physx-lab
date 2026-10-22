/**
 * Simulation clock.
 *
 * Design goals:
 *  - Physical time must not depend on React render frequency or the display
 *    refresh rate: the clock integrates wall-clock deltas (capped) scaled by
 *    the playback rate inside a single requestAnimationFrame loop.
 *  - Per-frame consumers (3D scenes, canvases, live readouts) subscribe with
 *    plain callbacks instead of React state, so a running simulation does not
 *    re-render the component tree 60×/s.
 *  - Parameter changes while paused call `bump()` so every view redraws
 *    consistently from the same source of truth.
 */

export type ClockListener = (t: number, dtSim: number) => void;

export interface SimClockOptions {
  rate?: number;
  /** Optional soft maximum used by scrub UIs; the clock itself is unbounded. */
  maxTime?: number;
}

const MAX_FRAME_MS = 50; // clamp huge tab-switch deltas

export class SimClock {
  private t = 0;
  private running = false;
  private rate: number;
  readonly maxTime: number;
  private rafId: number | null = null;
  private lastWall: number | null = null;
  private listeners = new Set<ClockListener>();
  private disposed = false;

  constructor(options: SimClockOptions = {}) {
    this.rate = options.rate ?? 1;
    this.maxTime = options.maxTime ?? Number.POSITIVE_INFINITY;
  }

  getTime(): number {
    return this.t;
  }

  isRunning(): boolean {
    return this.running;
  }

  getRate(): number {
    return this.rate;
  }

  subscribe(listener: ClockListener): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    // Deliver the current state immediately so late subscribers synchronize.
    try {
      listener(this.t, 0);
    } catch (err) {
      console.error('SimClock subscriber error', err);
    }
    this.manageLoop();
    return () => {
      this.listeners.delete(listener);
      this.manageLoop();
    };
  }

  play(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastWall = null;
    this.manageLoop();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.manageLoop();
  }

  toggle(): boolean {
    if (this.running) this.pause();
    else this.play();
    return this.running;
  }

  reset(): void {
    this.t = 0;
    this.lastWall = null;
    this.notify(0);
  }

  setTime(t: number): void {
    if (!Number.isFinite(t)) return;
    this.t = Math.max(0, Math.min(this.maxTime, t));
    this.lastWall = null;
    this.notify(0);
  }

  /** Advance one fixed simulation step while paused (single-step control). */
  step(dtSim = 1 / 60): void {
    if (!Number.isFinite(dtSim) || dtSim <= 0) return;
    if (this.running) this.pause();
    this.t = Math.min(this.maxTime, this.t + dtSim * this.rate);
    this.notify(dtSim * this.rate);
  }

  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.rate = Math.min(8, Math.max(0.05, rate));
  }

  /** Notify subscribers without advancing time (e.g. after parameter edits). */
  bump(): void {
    this.notify(0);
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    this.listeners.clear();
    this.manageLoop();
  }

  private notify(dtSim: number): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l(this.t, dtSim);
      } catch (err) {
        console.error('SimClock subscriber error', err);
      }
    }
  }

  private manageLoop(): void {
    const needLoop = this.running && this.listeners.size > 0 && !this.disposed;
    if (needLoop && this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    } else if (!needLoop && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (wall: number): void => {
    if (!this.running || this.disposed) {
      this.rafId = null;
      return;
    }
    const last = this.lastWall ?? wall;
    const dtMs = Math.min(MAX_FRAME_MS, Math.max(0, wall - last));
    this.lastWall = wall;
    const dtSim = (dtMs / 1000) * this.rate;
    this.t = Math.min(this.maxTime, this.t + dtSim);
    this.notify(dtSim);
    this.rafId = requestAnimationFrame(this.loop);
  };
}
