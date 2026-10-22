import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Panel, Callout } from '../../components/ui/primitives';
import { ParamSlider } from '../../components/controls/ParamSlider';
import { MathTex } from '../../components/math/MathTex';
import { formatValue } from '../../utils/format';
import {
  DIMENSIONLESS,
  QUANTITY_LIBRARY,
  checkEquationConsistency,
  divDimensions,
  formatDimensions,
  mulDimensions,
  powDimensions,
} from '../../physics/mathreview/dimensions';
import type { Dimensions } from '../../physics/mathreview/dimensions';

/**
 * Module A — Mathematical revision (supporting study material).
 * The PHYS220 syllabus opens with a mathematical-revision block; it does not
 * enumerate sub-topics, so these tools cover the standard prerequisites the
 * later chapters rely on and are labelled as supporting material.
 */

const TOOLS = [
  { id: 'radians', label: 'Radians & unit circle' },
  { id: 'sinusoids', label: 'Sinusoidal functions' },
  { id: 'units', label: 'Units & dimensions' },
  { id: 'notation', label: 'Scientific notation' },
  { id: 'calculus', label: 'Calculus for motion' },
];

/** Simple static canvas that redraws whenever `draw` inputs change. */
function PlotCanvas({
  draw,
  height = 240,
  ariaLabel,
  redrawKey,
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  height?: number;
  ariaLabel: string;
  redrawKey: unknown;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      if (w <= 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      drawRef.current(ctx, w, height);
    };
    render();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(render) : null;
    if (wrapRef.current && ro) ro.observe(wrapRef.current);
    return () => ro?.disconnect();
  }, [redrawKey, height]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} style={{ width: '100%', display: 'block' }} />
    </div>
  );
}

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    text: get('--text', '#e9edf7'),
    dim: get('--text-dim', '#9aa7c2'),
    faint: get('--text-faint', '#64708c'),
    grid: get('--grid-line', 'rgba(94,140,255,0.09)'),
    cyan: '#22d3ee',
    violet: '#a78bfa',
    amber: '#fbbf24',
    red: '#f87171',
    green: '#34d399',
  };
}

/* ---------------- radians ---------------- */

function RadiansTool() {
  const [deg, setDeg] = useState(60);
  const rad = (deg * Math.PI) / 180;

  const common = [0, 30, 45, 60, 90, 120, 135, 150, 180, 270, 360];

  return (
    <div className="grid-2">
      <Panel title="Unit circle">
        <PlotCanvas
          height={280}
          redrawKey={deg}
          ariaLabel={`Unit circle with an angle of ${deg} degrees (${formatValue(rad)} radians). Cosine projection ${formatValue(Math.cos(rad))}, sine projection ${formatValue(Math.sin(rad))}.`}
          draw={(ctx, w, h) => {
            const cc = themeColors();
            const cx = w / 2;
            const cy = h / 2;
            const R = Math.min(w, h) * 0.36;
            ctx.strokeStyle = cc.grid;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - R - 18, cy);
            ctx.lineTo(cx + R + 18, cy);
            ctx.moveTo(cx, cy - R - 18);
            ctx.lineTo(cx, cy + R + 18);
            ctx.stroke();
            const a = (deg * Math.PI) / 180;
            const px = cx + R * Math.cos(a);
            const py = cy - R * Math.sin(a);
            // angle arc
            ctx.strokeStyle = cc.amber;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.25, -a, 0);
            ctx.stroke();
            // radius
            ctx.strokeStyle = cc.text;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
            ctx.stroke();
            // cos projection
            ctx.strokeStyle = cc.cyan;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, cy);
            ctx.stroke();
            // sin projection
            ctx.strokeStyle = cc.violet;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(cx, py);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = cc.amber;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "12px Consolas, monospace";
            ctx.fillStyle = cc.cyan;
            ctx.fillText(`cos θ = ${Math.cos(a).toFixed(3)}`, cx + 6, cy + 16);
            ctx.fillStyle = cc.violet;
            ctx.fillText(`sin θ = ${Math.sin(a).toFixed(3)}`, cx - 96, py - 8);
            ctx.lineWidth = 1;
          }}
        />
        <ParamSlider label="Angle" symbol="θ" unit="°" value={deg} min={0} max={360} step={1} precision={0} onChange={setDeg} />
        <div className="measure-grid" style={{ marginTop: 8 }}>
          <div className="measure accent">
            <div className="m-label">Radians</div>
            <div className="m-value">{formatValue(rad)} <span className="m-unit">rad</span></div>
          </div>
          <div className="measure">
            <div className="m-label">sin θ</div>
            <div className="m-value">{formatValue(Math.sin(rad))}</div>
          </div>
          <div className="measure">
            <div className="m-label">cos θ</div>
            <div className="m-value">{formatValue(Math.cos(rad))}</div>
          </div>
          <div className="measure">
            <div className="m-label">tan θ</div>
            <div className="m-value">{Math.abs(Math.cos(rad)) < 1e-9 ? 'undefined' : formatValue(Math.tan(rad))}</div>
          </div>
        </div>
      </Panel>
      <Panel title="Why radians?">
        <div className="prose">
          <p>
            One radian is the angle subtended by an arc equal in length to the radius: a full turn
            is 2π rad = 360°. Conversion:
          </p>
          <MathTex tex="\theta_{\text{rad}} = \theta_{\text{deg}}\cdot\frac{\pi}{180},\qquad \theta_{\text{deg}} = \theta_{\text{rad}}\cdot\frac{180}{\pi}" display />
          <p>
            <b>Radians are required for calculus.</b> The clean derivatives
            d(sin x)/dx = cos x and d(cos x)/dx = −sin x hold <i>only</i> in radians — which is
            why ω in x(t) = A cos(ωt + φ) is measured in rad/s.
          </p>
          <table className="table-simple">
            <thead>
              <tr><th>Degrees</th><th>Radians</th><th>sin</th><th>cos</th></tr>
            </thead>
            <tbody>
              {common.map((d) => (
                <tr key={d}>
                  <td className="mono">{d}°</td>
                  <td className="mono">{d === 0 ? '0' : d === 30 ? 'π/6' : d === 45 ? 'π/4' : d === 60 ? 'π/3' : d === 90 ? 'π/2' : d === 120 ? '2π/3' : d === 135 ? '3π/4' : d === 150 ? '5π/6' : d === 180 ? 'π' : d === 270 ? '3π/2' : '2π'}</td>
                  <td className="mono">{Math.sin((d * Math.PI) / 180).toFixed(3)}</td>
                  <td className="mono">{Math.cos((d * Math.PI) / 180).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Callout>
            Try it: set θ = 90° above. The projections read cos = 0, sin = 1 — the point sits at
            the top of the circle. This circle is exactly the reference circle of §15.4.
          </Callout>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- sinusoids ---------------- */

function SinusoidTool() {
  const [A, setA] = useState(1);
  const [B, setB] = useState(1);
  const [C, setC] = useState(0);
  const [D, setD] = useState(0);
  const period = (2 * Math.PI) / B;
  const shift = -C / B;

  return (
    <div className="grid-2">
      <Panel title="y = A sin(Bx + C) + D">
        <PlotCanvas
          height={300}
          redrawKey={[A, B, C, D]}
          ariaLabel={`Graph of y = ${formatValue(A)} sin(${formatValue(B)}x + ${formatValue(C)}) + ${formatValue(D)} over x from -2π to 4π. Period ${formatValue(period)}, horizontal shift ${formatValue(shift)}.`}
          draw={(ctx, w, h) => {
            const cc = themeColors();
            const x0 = -2 * Math.PI;
            const x1 = 4 * Math.PI;
            const yMax = Math.max(Math.abs(A) + Math.abs(D) + 0.4, 1.6);
            const px = (x: number) => 40 + ((x - x0) / (x1 - x0)) * (w - 60);
            const py = (y: number) => h / 2 - (y / yMax) * (h / 2 - 24);
            ctx.strokeStyle = cc.grid;
            for (let gx = Math.ceil(x0); gx <= x1; gx += 1) {
              if (Math.abs(gx % (Math.PI / 2)) > 1e-9) continue;
              ctx.beginPath();
              ctx.moveTo(px(gx), 10);
              ctx.lineTo(px(gx), h - 18);
              ctx.stroke();
            }
            ctx.strokeStyle = cc.faint;
            ctx.beginPath();
            ctx.moveTo(px(x0), py(0));
            ctx.lineTo(px(x1), py(0));
            ctx.stroke();
            // offset line y = D
            if (D !== 0) {
              ctx.strokeStyle = cc.green;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(px(x0), py(D));
              ctx.lineTo(px(x1), py(D));
              ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.strokeStyle = cc.cyan;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let i = 0; i <= 600; i++) {
              const x = x0 + ((x1 - x0) * i) / 600;
              const y = A * Math.sin(B * x + C) + D;
              if (i === 0) ctx.moveTo(px(x), py(y));
              else ctx.lineTo(px(x), py(y));
            }
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = cc.faint;
            ctx.font = "10px Consolas, monospace";
            for (const [xv, lab] of [[0, '0'], [Math.PI, 'π'], [2 * Math.PI, '2π'], [3 * Math.PI, '3π']] as [number, string][]) {
              ctx.fillText(lab, px(xv) - 4, py(0) + 14);
            }
            // period bracket
            ctx.strokeStyle = cc.amber;
            const xb = shift;
            ctx.beginPath();
            ctx.moveTo(px(xb), py(D) + 26);
            ctx.lineTo(px(xb + period), py(D) + 26);
            ctx.stroke();
            ctx.fillStyle = cc.amber;
            ctx.fillText(`period 2π/B = ${period.toFixed(2)}`, px(xb) + 6, py(D) + 40);
          }}
        />
      </Panel>
      <Panel title="Reading the parameters">
        <ParamSlider label="Amplitude" symbol="A" value={A} min={0.1} max={3} step={0.05} onChange={setA} />
        <ParamSlider label="Angular rate" symbol="B" value={B} min={0.25} max={4} step={0.05} onChange={setB} tooltip="Period = 2π/B; in waves B plays the role of k (spatial) or ω (temporal)" />
        <ParamSlider label="Phase offset" symbol="C" unit="rad" value={C} min={-Math.PI} max={Math.PI} step={0.05} onChange={setC} />
        <ParamSlider label="Vertical offset" symbol="D" value={D} min={-2} max={2} step={0.05} onChange={setD} />
        <div className="measure-grid">
          <div className="measure accent"><div className="m-label">Period 2π/B</div><div className="m-value">{formatValue(period)}</div></div>
          <div className="measure violet"><div className="m-label">Phase shift −C/B</div><div className="m-value">{formatValue(shift)}</div></div>
          <div className="measure"><div className="m-label">Range</div><div className="m-value">[{formatValue(D - Math.abs(A))}, {formatValue(D + Math.abs(A))}]</div></div>
          <div className="measure amber"><div className="m-label">Max slope |AB|</div><div className="m-value">{formatValue(Math.abs(A * B))}</div></div>
        </div>
        <div className="prose">
          <p>
            This is the exact shape of every oscillation and wave in PHYS220: displacement of an
            oscillator x(t) = A cos(ωt + φ), a travelling wave y(x, t) = A sin(kx − ωt + φ), and a
            standing wave y = 2A sin(kx) cos(ωt).
          </p>
          <p>
            <b>Amplitude</b> sets the extent, <b>B</b> sets how fast it repeats (period 2π/B),{' '}
            <b>C</b> slides the curve sideways by −C/B, <b>D</b> lifts it. The maximum slope is
            |AB| — the derivative idea used for velocity in SHM.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- units & dimensions ---------------- */

const EQ_PRESETS: { label: string; lhs: Dimensions[]; terms: Dimensions[][] }[] = [
  {
    label: 'v = √(Tₛ/μ)  (string wave speed)',
    lhs: [{ M: 0, L: 1, T: -1 }],
    terms: [[powDimensions(divDimensions({ M: 1, L: 1, T: -2 }, { M: 1, L: -1, T: 0 }), 0.5)]],
  },
  {
    label: 'T = 2π√(m/k)  (oscillator period)',
    lhs: [{ M: 0, L: 0, T: 1 }],
    terms: [[powDimensions(divDimensions({ M: 1, L: 0, T: 0 }, { M: 1, L: 0, T: -2 }), 0.5)]],
  },
  {
    label: 'E = ½kA² = ½mv²  (energy, two terms)',
    lhs: [{ M: 1, L: 2, T: -2 }],
    terms: [
      [{ M: 1, L: 0, T: -2 }, { M: 0, L: 2, T: 0 }],
      [{ M: 1, L: 0, T: 0 }, { M: 0, L: 2, T: -2 }],
    ],
  },
  {
    label: 'P = ½μω²A²v  (wave power)',
    lhs: [{ M: 1, L: 2, T: -3 }],
    terms: [[{ M: 1, L: -1, T: 0 }, { M: 0, L: 0, T: -2 }, { M: 0, L: 2, T: 0 }, { M: 0, L: 1, T: -1 }]],
  },
  {
    label: '✗ v = a  (deliberately WRONG)',
    lhs: [{ M: 0, L: 1, T: -1 }],
    terms: [[{ M: 0, L: 1, T: -2 }]],
  },
];

function UnitsTool() {
  const [eqIdx, setEqIdx] = useState(0);
  const [q1, setQ1] = useState(6); // force
  const [q2, setQ2] = useState(8); // energy
  const [op, setOp] = useState<'mul' | 'div'>('div');

  const eq = EQ_PRESETS[eqIdx];
  const check = useMemo(() => {
    const all = [...eq.terms, eq.lhs];
    const res = checkEquationConsistency(all);
    return res;
  }, [eq]);

  const d1 = QUANTITY_LIBRARY[q1].dimensions;
  const d2 = QUANTITY_LIBRARY[q2].dimensions;
  const combined = op === 'mul' ? mulDimensions(d1, d2) : divDimensions(d1, d2);

  return (
    <div className="grid-2">
      <Panel title="Equation consistency checker">
        <div className="field">
          <span className="field-label">Choose an equation</span>
          <select className="select" value={eqIdx} aria-label="Equation to check" onChange={(e) => setEqIdx(Number(e.target.value))}>
            {EQ_PRESETS.map((e, i) => (
              <option key={e.label} value={i}>{e.label}</option>
            ))}
          </select>
        </div>
        <div className="prose">
          <p>Every additive term must carry identical dimensions, and both sides must match:</p>
          <ul>
            <li>LHS: <span className="mono">{formatDimensions(eq.lhs[0])}</span></li>
            {eq.terms.map((term, i) => (
              <li key={i}>
                Term {i + 1}: factors [{term.map(formatDimensions).join(' × ')}] →{' '}
                <span className="mono">
                  {formatDimensions(term.reduce<Dimensions>((a, b) => mulDimensions(a, b), DIMENSIONLESS))}
                </span>
              </li>
            ))}
          </ul>
          <Callout kind={check.consistent ? 'ok' : 'error'}>
            {check.consistent
              ? '✓ Dimensionally consistent — the equation can be physically meaningful (consistency is necessary, not sufficient).'
              : '✗ Dimensionally INCONSISTENT — the equation cannot be correct as written. Velocity (L T⁻¹) can never equal acceleration (L T⁻²).'}
          </Callout>
        </div>
      </Panel>
      <Panel title="Combine quantities">
        <div className="field">
          <span className="field-label">Quantity 1</span>
          <select className="select" value={q1} aria-label="First quantity" onChange={(e) => setQ1(Number(e.target.value))}>
            {QUANTITY_LIBRARY.map((q, i) => (
              <option key={q.name} value={i}>{q.name} [{q.unit}]</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="field-label">Operation</span>
          <div className="segmented" role="group" aria-label="Operation">
            <button type="button" aria-pressed={op === 'mul'} onClick={() => setOp('mul')}>×</button>
            <button type="button" aria-pressed={op === 'div'} onClick={() => setOp('div')}>÷</button>
          </div>
        </div>
        <div className="field">
          <span className="field-label">Quantity 2</span>
          <select className="select" value={q2} aria-label="Second quantity" onChange={(e) => setQ2(Number(e.target.value))}>
            {QUANTITY_LIBRARY.map((q, i) => (
              <option key={q.name} value={i}>{q.name} [{q.unit}]</option>
            ))}
          </select>
        </div>
        <Callout>
          <b>Result dimensions:</b> <span className="mono">{formatDimensions(combined)}</span>
          {combined.M === 1 && combined.L === 1 && combined.T === -2 && <span> — that’s a force (N).</span>}
          {combined.M === 1 && combined.L === 2 && combined.T === -2 && <span> — that’s an energy (J).</span>}
          {combined.M === 0 && combined.L === 1 && combined.T === -1 && <span> — that’s a velocity (m/s).</span>}
          {combined.M === 0 && combined.L === 0 && combined.T === 0 && <span> — dimensionless (a pure number or ratio).</span>}
        </Callout>
        <div className="prose">
          <p>
            <b>Base dimensions.</b> Mechanics reduces to mass M, length L and time T. A unit is a
            named bundle of these: N = kg·m/s² = M L T⁻²; J = N·m = M L² T⁻²; W = J/s = M L² T⁻³;
            Hz = 1/s = T⁻¹.
          </p>
          <p>
            <b>Rearranging equations</b> keeps dimensions balanced automatically: from v = √(Tₛ/μ),
            squaring gives v² = Tₛ/μ, so Tₛ = μv² — check: (M L⁻¹)(L² T⁻²) = M L T⁻² = force ✓.
            Practice rearranging by solving each formula for a different variable and verifying
            with this tool.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- scientific notation ---------------- */

const PREFIXES: [string, string, number][] = [
  ['nano', 'n', 1e-9],
  ['micro', 'µ', 1e-6],
  ['milli', 'm', 1e-3],
  ['', '', 1],
  ['kilo', 'k', 1e3],
  ['mega', 'M', 1e6],
  ['giga', 'G', 1e9],
];

function NotationTool() {
  const [raw, setRaw] = useState('0.025');
  const value = Number(raw.replace(/,/g, '.'));
  const valid = raw.trim() !== '' && Number.isFinite(value);

  const sci = valid ? value.toExponential(3) : '—';
  const best = useMemo(() => {
    if (!valid || value === 0) return null;
    const abs = Math.abs(value);
    let bestP = PREFIXES[3];
    let bestErr = Infinity;
    for (const p of PREFIXES) {
      const scaled = abs / p[2];
      if (scaled >= 1 && scaled < 1000) {
        const err = Math.abs(Math.log10(scaled) - Math.log10(1.5));
        if (err < bestErr) {
          bestErr = err;
          bestP = p;
        }
      }
    }
    return { scaled: value / bestP[2], name: bestP[0], sym: bestP[1] };
  }, [value, valid]);

  return (
    <div className="grid-2">
      <Panel title="Converter">
        <div className="field">
          <label className="field-label" htmlFor="notation-input">Enter a number</label>
          <input
            id="notation-input"
            className="num-input"
            style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-mono)' }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="decimal"
          />
          {!valid && raw.trim() !== '' && <span className="field-error">Not a finite number — check the input.</span>}
        </div>
        <div className="measure-grid">
          <div className="measure accent">
            <div className="m-label">Scientific notation</div>
            <div className="m-value" style={{ fontSize: '0.95rem' }}>{sci}</div>
          </div>
          <div className="measure violet">
            <div className="m-label">Engineering prefix</div>
            <div className="m-value" style={{ fontSize: '0.95rem' }}>
              {best ? `${formatValue(best.scaled)} ${best.sym}` : '—'}
            </div>
          </div>
        </div>
        <div className="prose">
          <p>
            PHYS220 spans huge scales: a spring constant ~10¹ N/m, light speed 2.998 × 10⁸ m/s,
            optical wavelengths ~5 × 10⁻⁷ m. Write every quantity as (number between 1 and 10) ×
            10ⁿ plus its unit, and keep the exponent with the unit when substituting into formulas.
          </p>
        </div>
      </Panel>
      <Panel title="Scale reference">
        <table className="table-simple">
          <thead><tr><th>Prefix</th><th>Symbol</th><th>Factor</th><th>PHYS220 example</th></tr></thead>
          <tbody>
            <tr><td>giga</td><td className="mono">G</td><td className="mono">10⁹</td><td>—</td></tr>
            <tr><td>mega</td><td className="mono">M</td><td className="mono">10⁶</td><td>ultrasound 1–10 MHz</td></tr>
            <tr><td>kilo</td><td className="mono">k</td><td className="mono">10³</td><td>string wave speeds ~10² m/s</td></tr>
            <tr><td>(base)</td><td className="mono">—</td><td className="mono">10⁰</td><td>metre, second, newton, joule</td></tr>
            <tr><td>milli</td><td className="mono">m</td><td className="mono">10⁻³</td><td>amplitudes ~10⁻² m</td></tr>
            <tr><td>micro</td><td className="mono">µ</td><td className="mono">10⁻⁶</td><td>linear densities ~10⁻³–10⁻⁵ kg/m</td></tr>
            <tr><td>nano</td><td className="mono">n</td><td className="mono">10⁻⁹</td><td>light wavelength ~500 nm</td></tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* ---------------- calculus for motion ---------------- */

function CalculusTool() {
  const [x0, setX0] = useState(1);
  const fn = (x: number) => Math.sin(x);
  const dfn = (x: number) => Math.cos(x);
  const h = 1e-5;
  const slopeNumeric = (fn(x0 + h) - fn(x0 - h)) / (2 * h);
  const slopeExact = dfn(x0);
  // numeric integral 0..x0 (Simpson)
  const integral = useMemo(() => {
    const n = 400;
    const a = 0;
    const b = x0;
    if (Math.abs(b - a) < 1e-12) return 0;
    const step = (b - a) / n;
    let s = fn(a) + fn(b);
    for (let i = 1; i < n; i++) s += fn(a + i * step) * (i % 2 === 0 ? 2 : 4);
    return (s * step) / 3;
  }, [x0]);

  return (
    <div className="grid-2">
      <Panel title="Derivative = slope, integral = area">
        <PlotCanvas
          height={280}
          redrawKey={x0}
          ariaLabel={`Graph of sine from 0 to 2π with the tangent line at x = ${formatValue(x0)} (slope ${formatValue(slopeExact)}) and the shaded area under the curve from 0 to x.`}
          draw={(ctx, w, hgt) => {
            const cc = themeColors();
            const x0v = -0.6;
            const x1v = 2 * Math.PI + 0.6;
            const px = (x: number) => 36 + ((x - x0v) / (x1v - x0v)) * (w - 56);
            const py = (y: number) => hgt / 2 - y * (hgt / 2 - 26);
            // area shading 0..x0
            ctx.fillStyle = 'rgba(167,139,250,0.18)';
            ctx.beginPath();
            ctx.moveTo(px(0), py(0));
            for (let i = 0; i <= 120; i++) {
              const x = (x0 * i) / 120;
              ctx.lineTo(px(x), py(fn(x)));
            }
            ctx.lineTo(px(x0), py(0));
            ctx.closePath();
            ctx.fill();
            // axes
            ctx.strokeStyle = cc.faint;
            ctx.beginPath();
            ctx.moveTo(px(x0v), py(0));
            ctx.lineTo(px(x1v), py(0));
            ctx.moveTo(px(0), py(-1.35));
            ctx.lineTo(px(0), py(1.35));
            ctx.stroke();
            // curve
            ctx.strokeStyle = cc.cyan;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let i = 0; i <= 400; i++) {
              const x = x0v + ((x1v - x0v) * i) / 400;
              if (i === 0) ctx.moveTo(px(x), py(fn(x)));
              else ctx.lineTo(px(x), py(fn(x)));
            }
            ctx.stroke();
            ctx.lineWidth = 1;
            // tangent at x0
            const m = Math.cos(x0);
            ctx.strokeStyle = cc.amber;
            ctx.beginPath();
            const tl = 1.2;
            ctx.moveTo(px(x0 - tl), py(fn(x0) - m * tl));
            ctx.lineTo(px(x0 + tl), py(fn(x0) + m * tl));
            ctx.stroke();
            ctx.fillStyle = cc.amber;
            ctx.beginPath();
            ctx.arc(px(x0), py(fn(x0)), 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "11px Consolas, monospace";
            ctx.fillText(`slope = cos(x₀) = ${m.toFixed(3)}`, px(x0) + 10, py(fn(x0)) - 12);
            ctx.fillStyle = cc.faint;
            ctx.fillText('f(x) = sin x', px(5.1), py(0.6));
            ctx.fillText('x', px(x1v) - 8, py(0) + 14);
          }}
        />
        <ParamSlider label="Point of interest" symbol="x₀" value={x0} min={-0.5} max={6.5} step={0.01} onChange={setX0} />
      </Panel>
      <Panel title="What it means for physics">
        <div className="measure-grid">
          <div className="measure amber"><div className="m-label">Slope (exact cos x₀)</div><div className="m-value">{formatValue(slopeExact, 5)}</div></div>
          <div className="measure"><div className="m-label">Slope (numeric Δ)</div><div className="m-value">{formatValue(slopeNumeric, 5)}</div></div>
          <div className="measure violet"><div className="m-label">Area ∫₀ˣ⁰ sin x dx = 1−cos x₀</div><div className="m-value">{formatValue(integral, 4)}</div></div>
          <div className="measure green"><div className="m-label">Exact 1−cos x₀</div><div className="m-value">{formatValue(1 - Math.cos(x0), 4)}</div></div>
        </div>
        <div className="prose">
          <p>
            <b>Derivative = instantaneous rate of change = slope of the tangent.</b> In motion:
            v = dx/dt and a = dv/dt. For SHM, differentiating x = A cos(ωt + φ) once gives
            v = −Aω sin(ωt + φ); twice gives a = −ω²x — the SHM equation of motion itself.
          </p>
          <p>
            <b>Integral = accumulation = area under the curve.</b> Going backwards:
            x(t) = x₀ + ∫v dt. The numeric area above (Simpson’s rule, 400 slices) matches the
            exact antiderivative 1 − cos x₀ to display precision — the same agreement the
            simulations rely on.
          </p>
          <p>
            <b>Small-angle note.</b> For θ in radians and |θ| ≪ 1: sin θ ≈ θ and cos θ ≈ 1 − θ²/2.
            Zoom the point near x₀ = 0 to see the tangent (slope ≈ 1) hug the curve — this is why
            pendulum and paraxial optics approximations work.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- page ---------------- */

export function MathReviewPage() {
  const { tab } = useParams();
  const active = TOOLS.find((t) => t.id === tab) ?? TOOLS[0];

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Module A · Mathematical revision — supporting study material</div>
        <h1>Math Toolkit</h1>
        <p>
          The PHYS220 syllabus opens with a mathematical-revision block before Chapter 15 but does
          not enumerate its sub-topics. These interactive tools cover the standard prerequisites
          the course relies on — they are labelled as <b>supporting study material</b>, not as a
          syllabus-specified schedule.
        </p>
      </div>
      <div className="section-tabs" role="tablist" aria-label="Math toolkit sections">
        {TOOLS.map((t) => (
          <NavLink key={t.id} to={`/math-review/${t.id}`} className={`section-tab ${t.id === active.id ? 'active' : ''}`} role="tab" aria-selected={t.id === active.id}>
            {t.label}
          </NavLink>
        ))}
      </div>
      {active.id === 'radians' && <RadiansTool />}
      {active.id === 'sinusoids' && <SinusoidTool />}
      {active.id === 'units' && <UnitsTool />}
      {active.id === 'notation' && <NotationTool />}
      {active.id === 'calculus' && <CalculusTool />}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="row">
          <BookOpen size={16} style={{ color: 'var(--cyan)' }} />
          <span className="prose" style={{ margin: 0 }}>
            Ready for the physics? Start with <NavLink to="/oscillatory-motion/spring">§15.1 — Spring &amp; mass</NavLink>.
          </span>
        </div>
      </div>
    </div>
  );
}
