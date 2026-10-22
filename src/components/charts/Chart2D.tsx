import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimClock } from '../../simulation/SimClock';
import { useClockEffect } from '../../simulation/useSimClock';
import { DASH_CYCLE } from '../theme';

export interface ChartSeriesData {
  name: string;
  color: string;
  /** Optional explicit dash pattern; otherwise cycles for accessibility. */
  dash?: number[];
  /** Interleaved [x0, y0, x1, y1, …] samples. Empty ⇒ series skipped. */
  data: Float64Array;
}

export interface Chart2DProps {
  title?: string;
  xLabel: string;
  yLabel: string;
  /** Called on every redraw — must return fresh samples from the model. */
  series: () => ChartSeriesData[];
  /** When provided, the chart redraws on every clock tick (running or bump). */
  clock?: SimClock;
  /** Any change forces a redraw (parameter edits). */
  redrawKey?: unknown;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** Force the y domain symmetric around zero (wave plots). */
  ySymmetric?: boolean;
  /** Vertical marker, e.g. the current simulation time. */
  marker?: { x: () => number; label?: string; color?: string } | null;
  /** Called with the data-space x when the user clicks inside the plot
   * (used for click-to-seek time inspection). */
  onPickX?: (x: number) => void;
  height?: number;
  /** Digits used for tick/tooltip formatting. */
  precision?: number;
  /** Plain-text equivalent of the plot for screen readers. */
  ariaSummary?: string;
  showLegend?: boolean;
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = niceStep((max - min) / count);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function fmt(v: number, precision: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e5 || abs < 1e-3)) return v.toExponential(Math.max(1, precision - 1));
  return v.toFixed(Math.min(6, precision));
}

/** High-DPI aware scientific line chart rendered on a 2D canvas. */
export function Chart2D({
  title,
  xLabel,
  yLabel,
  series,
  clock,
  redrawKey,
  xDomain,
  yDomain,
  ySymmetric = false,
  marker = null,
  onPickX,
  height = 210,
  precision = 2,
  ariaSummary,
  showLegend = true,
}: Chart2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<{ px: number; py: number } | null>(null);
  const [hoverTick, setHoverTick] = useState(0); // triggers redraw on hover change
  const domainsRef = useRef({ x0: 0, x1: 1 });
  const marginsRef = useRef({ l: 56, plotW: 10 });

  const css = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const s = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
    return {
      text: get('--text', '#e9edf7'),
      dim: get('--text-dim', '#9aa7c2'),
      faint: get('--text-faint', '#64708c'),
      grid: get('--grid-line', 'rgba(94,140,255,0.09)'),
      border: get('--border', 'rgba(94,140,255,0.16)'),
      bg: get('--bg-2', '#0b1224'),
      panel: get('--panel-solid', '#0e1528'),
    };
    // Recompute theme colors when redrawKey/clock ticks — cheap enough once per draw.
  }, []);

  const draw = useMemo(
    () => () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = height;
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

      // Fresh theme colors each draw (theme may switch at runtime).
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
      const theme = css ?? {
        text: '#e9edf7',
        dim: '#9aa7c2',
        faint: '#64708c',
        grid: 'rgba(94,140,255,0.09)',
        border: 'rgba(94,140,255,0.16)',
        bg: '#0b1224',
        panel: '#0e1528',
      };
      const text = get('--text', theme.text);
      const dim = get('--text-dim', theme.dim);
      const faint = get('--text-faint', theme.faint);
      const grid = get('--grid-line', theme.grid);
      const panel = get('--panel-solid', theme.panel);

      const data = series();

      const m = { l: 56, r: 14, t: title ? 26 : 12, b: 34 };
      const plotW = Math.max(10, w - m.l - m.r);
      const plotH = Math.max(10, h - m.t - m.b);

      // Domains.
      let x0 = xDomain?.[0] ?? Infinity;
      let x1 = xDomain?.[1] ?? -Infinity;
      let y0 = yDomain?.[0] ?? Infinity;
      let y1 = yDomain?.[1] ?? -Infinity;
      if (!xDomain || !yDomain) {
        for (const s of data) {
          for (let i = 0; i + 1 < s.data.length; i += 2) {
            const x = s.data[i];
            const y = s.data[i + 1];
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (!xDomain) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
            }
            if (!yDomain) {
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
      }
      if (!Number.isFinite(x0) || !Number.isFinite(x1) || x0 === x1) {
        x0 = 0;
        x1 = 1;
      }
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) {
        y0 = -1;
        y1 = 1;
      }
      if (ySymmetric) {
        const ym = Math.max(Math.abs(y0), Math.abs(y1), 1e-12);
        y0 = -ym;
        y1 = ym;
      }
      if (!yDomain) {
        const pad = (y1 - y0) * 0.08 || Math.max(Math.abs(y1) * 0.1, 1e-6);
        y0 -= pad;
        y1 += pad;
        if (y0 === y1) {
          y0 -= 1;
          y1 += 1;
        }
      }
      domainsRef.current = { x0, x1 };
      marginsRef.current = { l: m.l, plotW };

      const toPx = (x: number, y: number): [number, number] => [
        m.l + ((x - x0) / (x1 - x0)) * plotW,
        m.t + (1 - (y - y0) / (y1 - y0)) * plotH,
      ];

      // Grid + ticks.
      ctx.font = "10.5px 'Segoe UI', system-ui, sans-serif";
      ctx.lineWidth = 1;
      const xt = ticks(x0, x1, Math.max(3, Math.floor(plotW / 90)));
      const yt = ticks(y0, y1, Math.max(3, Math.floor(plotH / 44)));
      ctx.strokeStyle = grid;
      ctx.fillStyle = faint;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const v of xt) {
        const [px] = toPx(v, y0);
        ctx.beginPath();
        ctx.moveTo(px, m.t);
        ctx.lineTo(px, m.t + plotH);
        ctx.stroke();
        ctx.fillText(fmt(v, precision), px, m.t + plotH + 5);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const v of yt) {
        const [, py] = toPx(x0, v);
        ctx.beginPath();
        ctx.moveTo(m.l, py);
        ctx.lineTo(m.l + plotW, py);
        ctx.stroke();
        ctx.fillText(fmt(v, precision), m.l - 7, py);
      }

      // Zero lines (subtle emphasis).
      ctx.strokeStyle = get('--border-strong', 'rgba(94,140,255,0.3)');
      if (y0 < 0 && y1 > 0) {
        const [, zy] = toPx(x0, 0);
        ctx.beginPath();
        ctx.moveTo(m.l, zy);
        ctx.lineTo(m.l + plotW, zy);
        ctx.stroke();
      }

      // Axis labels.
      ctx.fillStyle = dim;
      ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(xLabel, m.l + plotW / 2, h - 2);
      ctx.save();
      ctx.translate(12, m.t + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();

      if (title) {
        ctx.fillStyle = text;
        ctx.font = "600 11.5px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(title, m.l, 6);
      }

      const hasData = data.some((s) => s.data.length >= 4);
      if (!hasData) {
        ctx.fillStyle = dim;
        ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No valid data for the current configuration', m.l + plotW / 2, m.t + plotH / 2);
      }

      // Series.
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.l, m.t, plotW, plotH);
      ctx.clip();
      data.forEach((s, idx) => {
        if (s.data.length < 4) return;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.9;
        ctx.setLineDash(s.dash ?? DASH_CYCLE[idx % DASH_CYCLE.length]);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        for (let i = 0; i + 1 < s.data.length; i += 2) {
          const px = toPx(s.data[i], s.data[i + 1]);
          if (!Number.isFinite(px[0]) || !Number.isFinite(px[1])) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(px[0], px[1]);
            started = true;
          } else {
            ctx.lineTo(px[0], px[1]);
          }
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Current-time (or position) marker.
      if (marker) {
        const mx = marker.x();
        if (Number.isFinite(mx) && mx >= x0 && mx <= x1) {
          const [px] = toPx(mx, y0);
          ctx.strokeStyle = marker.color ?? get('--amber', '#fbbf24');
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(px, m.t);
          ctx.lineTo(px, m.t + plotH);
          ctx.stroke();
          ctx.setLineDash([]);
          if (marker.label) {
            ctx.fillStyle = marker.color ?? get('--amber', '#fbbf24');
            ctx.font = "10px Consolas, monospace";
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(marker.label, px + 4, m.t + 2);
          }
        }
      }

      // Hover crosshair + tooltip.
      const hover = hoverRef.current;
      if (hover && hasData) {
        const hx = x0 + ((hover.px - m.l) / plotW) * (x1 - x0);
        if (hover.px >= m.l && hover.px <= m.l + plotW) {
          ctx.strokeStyle = get('--border-strong', 'rgba(94,140,255,0.35)');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hover.px, m.t);
          ctx.lineTo(hover.px, m.t + plotH);
          ctx.stroke();

          const rows: { name: string; color: string; value: string }[] = [];
          for (const s of data) {
            if (s.data.length < 4) continue;
            // Nearest sample by x.
            let best = 0;
            let bestD = Infinity;
            for (let i = 0; i + 1 < s.data.length; i += 2) {
              const d = Math.abs(s.data[i] - hx);
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
            rows.push({ name: s.name, color: s.color, value: fmt(s.data[best + 1], precision + 1) });
            const [px, py] = toPx(s.data[best], s.data[best + 1]);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          // Tooltip box.
          const lines = [`x = ${fmt(hx, precision + 1)}`, ...rows.map((r) => `${r.name}: ${r.value}`)];
          ctx.font = "10.5px Consolas, monospace";
          const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 26;
          const boxH = lines.length * 14 + 10;
          let bx = hover.px + 10;
          if (bx + boxW > w - 4) bx = hover.px - boxW - 10;
          const by = Math.min(Math.max(4, hover.py - boxH / 2), h - boxH - 4);
          ctx.fillStyle = panel;
          ctx.strokeStyle = get('--border-strong', 'rgba(94,140,255,0.3)');
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          lines.forEach((l, i) => {
            if (i > 0) {
              ctx.fillStyle = rows[i - 1].color;
              ctx.fillRect(bx + 7, by + 9 + i * 14, 8, 3);
            }
            ctx.fillStyle = i === 0 ? dim : text;
            ctx.fillText(l, bx + (i === 0 ? 7 : 20), by + 5 + i * 14);
          });
        }
      }
      ctx.restore();

      // Legend.
      if (showLegend && hasData) {
        ctx.font = "10.5px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let lx = m.l + 8;
        const ly = m.t + (title ? 12 : 8);
        for (let i = 0; i < data.length; i++) {
          const s = data[i];
          if (s.data.length < 4) continue;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2;
          ctx.setLineDash(s.dash ?? DASH_CYCLE[i % DASH_CYCLE.length]);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + 18, ly);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = dim;
          ctx.fillText(s.name, lx + 23, ly);
          lx += 23 + ctx.measureText(s.name).width + 16;
          if (lx > w - 60) break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [css, height, marker, precision, series, showLegend, title, xDomain, xLabel, yDomain, yLabel, ySymmetric, hoverTick, redrawKey],
  );

  // Redraw on parameter / dependency change.
  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on every clock tick while subscribed (no-op without a clock).
  useClockEffect(clock ?? null, () => draw());

  // Resize handling.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // Theme changes.
  useEffect(() => {
    const obs = new MutationObserver(() => draw());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div className="panel chart-card">
      {title && <div className="chart-title"><span>{title}</span></div>}
      <div
        className="chart-canvas-wrap"
        ref={wrapRef}
        style={onPickX ? { cursor: 'crosshair' } : undefined}
        onClick={
          onPickX
            ? (e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const px = e.clientX - rect.left;
                const { l, plotW } = marginsRef.current;
                const { x0, x1 } = domainsRef.current;
                if (px < l || px > l + plotW || plotW <= 0) return;
                onPickX(x0 + ((px - l) / plotW) * (x1 - x0));
              }
            : undefined
        }
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          hoverRef.current = { px: e.clientX - rect.left, py: e.clientY - rect.top };
          setHoverTick((n) => n + 1);
        }}
        onMouseLeave={() => {
          hoverRef.current = null;
          setHoverTick((n) => n + 1);
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            ariaSummary ??
            `${title ?? ''} chart of ${yLabel} versus ${xLabel}. Enable JavaScript-free contexts aside, numeric equivalents appear in the measurements panel.`
          }
        />
      </div>
    </div>
  );
}
