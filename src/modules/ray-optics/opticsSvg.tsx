import { useCallback, useRef } from 'react';

/* ---------- geometry helpers (screen coordinates: y down, angles in degrees) ---------- */

export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * SVG arc path from angle a0 to a1 (degrees, screen convention) around (cx, cy).
 * Always sweeps the short way from a0 to a1 in the direction of increasing angle
 * unless a1 < a0.
 */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const delta = a1 - a0;
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`;
}

/** Reflect direction vector d about the surface with unit normal n̂. */
export function reflectDirection(
  d: { x: number; y: number },
  n: { x: number; y: number },
): { x: number; y: number } {
  const dot = d.x * n.x + d.y * n.y;
  return { x: d.x - 2 * dot * n.x, y: d.y - 2 * dot * n.y };
}

export function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

/* ---------- arrow markers ---------- */

export function ArrowDefs({ id, colors }: { id: string; colors: Record<string, string> }) {
  return (
    <defs>
      {Object.entries(colors).map(([name, color]) => (
        <marker
          key={name}
          id={`${id}-${name}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

/* ---------- drag handling ---------- */

/** Convert a pointer event to SVG user-space coordinates. */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: pt.x, y: pt.y };
}

export function useSvgDrag(onDrag: (p: { x: number; y: number }) => void) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const svg = svgRef.current;
      if (svg) onDrag(svgPoint(svg, e.clientX, e.clientY));
    },
    [onDrag],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const svg = svgRef.current;
      if (svg) onDrag(svgPoint(svg, e.clientX, e.clientY));
    },
    [onDrag],
  );
  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { svgRef, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

/**
 * Accessible draggable handle: pointer drag plus keyboard support
 * (arrow keys nudge the controlled angle). Rendered as a focusable circle
 * with role="slider" semantics supplied by the parent lab.
 */
export function DragHandle({
  x,
  y,
  color,
  label,
  onDrag,
  onKeyDown,
  svgRef,
  valueText,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  onDrag: (p: { x: number; y: number }) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  valueText?: string;
}) {
  return (
    <g
      className="draggable"
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const svg = svgRef.current;
        if (svg) onDrag(svgPoint(svg, e.clientX, e.clientY));
        const move = (ev: PointerEvent) => {
          if (svg) onDrag(svgPoint(svg, ev.clientX, ev.clientY));
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    >
      <circle cx={x} cy={y} r={13} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5} />
      <circle cx={x} cy={y} r={4.5} fill={color} />
    </g>
  );
}
