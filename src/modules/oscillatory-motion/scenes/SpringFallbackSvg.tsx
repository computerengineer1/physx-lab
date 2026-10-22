import { useEffect, useRef } from 'react';
import type { SimClock } from '../../../simulation/SimClock';
import { useClockEffect } from '../../../simulation/useSimClock';
import type { SpringMassState } from './SpringMassScene';

/**
 * 2D SVG equivalent of the 3D spring–mass apparatus. Shown when WebGL is
 * unavailable (and used as the accessible/low-power representation). Driven
 * by the same clock and the same getState() model function.
 */
export function SpringFallbackSvg({
  getState,
  clock,
}: {
  getState: (t: number) => SpringMassState;
  clock: SimClock;
}) {
  const massRef = useRef<SVGRectElement>(null);
  const springRef = useRef<SVGPathElement>(null);
  const labelRef = useRef<SVGTextElement>(null);
  const getStateRef = useRef(getState);
  useEffect(() => {
    getStateRef.current = getState;
  });

  useClockEffect(clock, (t) => {
    const s = getStateRef.current(t);
    // SVG layout: support at y=30, equilibrium at y=170, scale 260 px/m.
    const pxPerM = 260;
    const massY = 170 + s.x * pxPerM;
    if (massRef.current) massRef.current.setAttribute('y', String(massY - 18));
    if (labelRef.current) {
      labelRef.current.setAttribute('y', String(massY + 34));
      labelRef.current.textContent = `x = ${s.x >= 0 ? '+' : '−'}${Math.abs(s.x).toFixed(3)} m`;
    }
    if (springRef.current) {
      const top = 38;
      const bottom = massY - 18;
      const coils = 9;
      const segH = (bottom - top) / (coils * 2);
      let d = `M 120 ${top}`;
      for (let i = 0; i < coils * 2; i++) {
        const x = i % 2 === 0 ? 140 : 100;
        d += ` L ${x} ${top + segH * (i + 1)}`;
      }
      d += ` L 120 ${bottom}`;
      springRef.current.setAttribute('d', d);
    }
  });

  return (
    <svg
      viewBox="0 0 240 330"
      style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto' }}
      role="img"
      aria-label="2D spring–mass oscillator: a mass hangs from a zig-zag spring and moves vertically about the dashed equilibrium line."
    >
        {/* support */}
        <rect x="60" y="20" width="120" height="12" fill="#2a3550" stroke="#5c6b8a" />
        {[70, 90, 110, 130, 150, 170].map((x) => (
          <line key={x} x1={x} y1={20} x2={x - 8} y2={10} stroke="#64748b" strokeWidth="1.5" />
        ))}
        {/* spring (updated per tick) */}
        <path ref={springRef} d="M 120 38 L 120 150" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinejoin="round" />
        {/* mass */}
        <rect ref={massRef} x="98" y="152" width="44" height="36" rx="6" fill="#4f7dff" stroke="#9db4ff" />
        <text x="120" y="175" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">m</text>
        {/* equilibrium */}
        <line x1="40" y1="170" x2="200" y2="170" stroke="#fbbf24" strokeWidth="1" strokeDasharray="5 4" />
        <text x="204" y="173" fill="#fbbf24" fontSize="9">x = 0</text>
      {/* live displacement label */}
      <text ref={labelRef} x="120" y="230" textAnchor="middle" fill="#9aa7c2" fontSize="11" fontFamily="Consolas, monospace" />
    </svg>
  );
}
