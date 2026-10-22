import { useEffect, useRef } from 'react';
import type { SimClock } from '../../simulation/SimClock';
import { useClockEffect } from '../../simulation/useSimClock';
import { useLatest } from '../../hooks/useLatest';

export interface Wave2DOptions {
  /** Displacement model y(x, t) in metres. */
  yAt: (x: number, t: number) => number;
  xMin: number;
  xMax: number;
  /** Max |y| used to scale the vertical axis [m]. */
  yMax: number;
  /** Extra overlay drawing in data coordinates. */
  annotate?: (ctx: CanvasRenderingContext2D, toPx: (x: number, y: number) => [number, number], t: number) => void;
  color?: string;
  height?: number;
  samples?: number;
  label?: string;
}

/**
 * Always-available 2D canvas rendering of a wave profile. Used as the
 * scientific fallback when WebGL is unavailable, and as the accessible
 * equivalent of the 3D string scenes. Redraws from the simulation clock —
 * same model, same time base as the 3D view.
 */
export function WaveCanvas2D({
  clock,
  options,
  redrawKey,
}: {
  clock: SimClock | null;
  options: Wave2DOptions;
  redrawKey?: unknown;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const optionsRef = useLatest(options);

  // The draw closure is recreated each render (fresh props) and stored in a
  // ref via effect, so imperative callers always invoke the latest version.
  const drawFn = (t: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const o = optionsRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = o.height ?? 150;
    if (w <= 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cs = getComputedStyle(document.documentElement);
    const grid = cs.getPropertyValue('--grid-line').trim() || 'rgba(94,140,255,0.09)';
    const faint = cs.getPropertyValue('--text-faint').trim() || '#64708c';
    const pad = { l: 10, r: 10, t: 10, b: 18 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const yScale = o.yMax > 0 ? o.yMax * 1.12 : 1;
    const toPx = (x: number, y: number): [number, number] => [
      pad.l + ((x - o.xMin) / (o.xMax - o.xMin)) * plotW,
      pad.t + (1 - (y + yScale) / (2 * yScale)) * plotH,
    ];

    // axis + grid
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    const [, zeroY] = toPx(o.xMin, 0);
    ctx.beginPath();
    ctx.moveTo(pad.l, zeroY);
    ctx.lineTo(w - pad.r, zeroY);
    ctx.stroke();
    ctx.fillStyle = faint;
    ctx.font = "9.5px Consolas, monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`x = ${o.xMin} m`, pad.l, h - 14);
    ctx.textAlign = 'right';
    ctx.fillText(`x = ${o.xMax} m`, w - pad.r, h - 14);

    // profile
    ctx.strokeStyle = o.color ?? '#22d3ee';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = o.samples ?? 320;
    for (let i = 0; i <= n; i++) {
      const x = o.xMin + ((o.xMax - o.xMin) * i) / n;
      const y = o.yAt(x, t);
      const [px, py] = toPx(x, Number.isFinite(y) ? y : 0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    o.annotate?.(ctx, toPx, t);
  };
  const drawRef = useRef(drawFn);
  useEffect(() => {
    drawRef.current = drawFn;
  });

  useClockEffect(clock, (t) => drawRef.current(t));

  useEffect(() => {
    drawRef.current(clock ? clock.getTime() : 0);
  }, [redrawKey, clock]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => drawRef.current(clock ? clock.getTime() : 0));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [clock]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={options.label ?? 'Wave displacement versus position (2D view of the same model)'}
        style={{ width: '100%', display: 'block' }}
      />
    </div>
  );
}
