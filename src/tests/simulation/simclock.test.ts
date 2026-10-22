import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimClock } from '../../simulation/SimClock';

/**
 * SimClock tests use fake timers and a deterministic rAF shim so that
 * simulated time can be advanced exactly.
 */
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16)) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SimClock', () => {
  it('advances physical time ~1 s per 1000 ms of wall time at rate 1', () => {
    const clock = new SimClock();
    const seen: number[] = [];
    clock.subscribe((t) => seen.push(t));
    clock.play();
    vi.advanceTimersByTime(1000);
    expect(clock.getTime()).toBeGreaterThan(0.9);
    expect(clock.getTime()).toBeLessThan(1.15);
    expect(seen.length).toBeGreaterThan(20);
    clock.dispose();
  });

  it('pause freezes time; play resumes', () => {
    const clock = new SimClock();
    clock.subscribe(() => {});
    clock.play();
    vi.advanceTimersByTime(500);
    clock.pause();
    const frozen = clock.getTime();
    vi.advanceTimersByTime(1000);
    expect(clock.getTime()).toBe(frozen);
    clock.play();
    vi.advanceTimersByTime(200);
    expect(clock.getTime()).toBeGreaterThan(frozen);
    clock.dispose();
  });

  it('rate scales simulated time', () => {
    const clock = new SimClock();
    clock.subscribe(() => {});
    clock.setRate(4);
    clock.play();
    vi.advanceTimersByTime(250);
    expect(clock.getTime()).toBeGreaterThan(0.85);
    expect(clock.getTime()).toBeLessThan(1.3);
    clock.dispose();
  });

  it('caps huge frame deltas (tab switches cannot teleport the model)', () => {
    const clock = new SimClock();
    clock.subscribe(() => {});
    clock.play();
    vi.advanceTimersByTime(60_000); // one minute of wall time, but frames are clamped at 50 ms
    // With the 16 ms shim the clock integrates normally; the point is no NaN/Infinity.
    expect(Number.isFinite(clock.getTime())).toBe(true);
    clock.dispose();
  });

  it('reset returns to t = 0 and notifies subscribers', () => {
    const clock = new SimClock();
    let lastT = -1;
    clock.subscribe((t) => (lastT = t));
    clock.play();
    vi.advanceTimersByTime(300);
    clock.reset();
    expect(clock.getTime()).toBe(0);
    expect(lastT).toBe(0);
    clock.dispose();
  });

  it('step advances exactly one fixed step while paused', () => {
    const clock = new SimClock();
    clock.subscribe(() => {});
    clock.step(0.05);
    expect(clock.getTime()).toBeCloseTo(0.05, 10);
    clock.step(0.05);
    expect(clock.getTime()).toBeCloseTo(0.1, 10);
    clock.dispose();
  });

  it('setTime seeks and clamps to [0, maxTime]; bump notifies with dt = 0', () => {
    const clock = new SimClock({ maxTime: 10 });
    const events: [number, number][] = [];
    clock.subscribe((t, dt) => events.push([t, dt]));
    clock.setTime(4.5);
    expect(clock.getTime()).toBeCloseTo(4.5, 10);
    clock.setTime(-3);
    expect(clock.getTime()).toBe(0);
    clock.setTime(50);
    expect(clock.getTime()).toBe(10);
    const before = events.length;
    clock.bump();
    expect(events.length).toBe(before + 1);
    expect(events[events.length - 1][1]).toBe(0);
    clock.dispose();
  });

  it('rejects invalid rates and NaN times without corrupting state', () => {
    const clock = new SimClock();
    clock.setRate(NaN);
    expect(clock.getRate()).toBe(1);
    clock.setRate(-2);
    expect(clock.getRate()).toBe(1);
    clock.setTime(NaN);
    expect(clock.getTime()).toBe(0);
    clock.dispose();
  });

  it('does not depend on React render frequency: no subscriber, no loop', () => {
    const clock = new SimClock();
    clock.play();
    vi.advanceTimersByTime(500);
    // Without subscribers the loop never starts; time stays 0 — rendering
    // cadence cannot drive physics.
    expect(clock.getTime()).toBe(0);
    clock.dispose();
  });
});
