import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { Callout } from '../../components/ui/primitives';
import { SaveBar } from '../../components/sim/SaveBar';
import { ParamSlider } from '../../components/controls/ParamSlider';
import { PresetBar } from '../../components/controls/PresetBar';
import type { Preset } from '../../components/controls/PresetBar';
import { PredictionPanel } from '../../components/education/PredictionPanel';
import { GuidedPanel } from '../../components/education/GuidedPanel';
import { PracticePanel } from '../../components/education/PracticePanel';
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { GuidedExperiment, PredictionScenario } from '../../education/types';
import {
  degToRad,
  lightSpeedInMedium,
  radToDeg,
  refract,
} from '../../physics/optics/rays';
import { formatValue } from '../../utils/format';
import { ArrowDefs, DragHandle, arcPath, polar } from '../ray-optics/opticsSvg';

interface RefractionParams {
  n1: number;
  n2: number;
  theta1: number; // deg
  showReflected: boolean;
}

const DEFAULTS: RefractionParams = { n1: 1.0, n2: 1.5, theta1: 40, showReflected: true };
const RANGES = {
  n1: { min: 1, max: 2.6 },
  n2: { min: 1, max: 2.6 },
  theta1: { min: 0, max: 85 },
};

const MATERIALS: { label: string; n: number }[] = [
  { label: 'Vacuum/air (1.00)', n: 1.0 },
  { label: 'Water (1.33)', n: 1.33 },
  { label: 'Acrylic (1.49)', n: 1.49 },
  { label: 'Crown glass (1.52)', n: 1.52 },
  { label: 'Diamond (2.42)', n: 2.42 },
];

const H = { x: 320, y: 210 }; // hit point on the interface
const R = 170;

const PRESETS: Preset<RefractionParams>[] = [
  { id: 'air-glass', label: 'Air → glass', params: { n1: 1.0, n2: 1.52, theta1: 40, showReflected: true } },
  { id: 'air-water', label: 'Air → water', params: { n1: 1.0, n2: 1.33, theta1: 55, showReflected: true } },
  { id: 'glass-air', label: 'Glass → air', params: { n1: 1.52, n2: 1.0, theta1: 25, showReflected: true } },
  { id: 'diamond', label: 'Diamond → air', params: { n1: 2.42, n2: 1.0, theta1: 20, showReflected: true } },
  { id: 'normal', label: 'Normal incidence', params: { n1: 1.33, n2: 1.52, theta1: 0, showReflected: true } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Toward or away from the normal?',
    objective: 'Link the index ratio n₂/n₁ to the bending direction.',
    setupLabel: 'Air → glass at 40°.',
    setup: { n1: 1.0, n2: 1.52, theta1: 40, showReflected: true },
    predictionPrompt: 'Entering a denser medium, does the ray bend toward or away from the normal?',
    procedure: [
      'Record θ₂ for air → glass.',
      'Swap: use the glass → air preset at the same θ₁ and record θ₂.',
      'Compare both with θ₁.',
    ],
    observe: 'θ₂ vs θ₁ for both directions of crossing.',
    conclusionPrompt: 'State the rule in terms of n₁ vs n₂ and light speed.',
  },
  {
    id: 'g2',
    title: 'Verify Snell’s law numerically',
    objective: 'Check n₁ sin θ₁ = n₂ sin θ₂ at several angles.',
    setupLabel: 'Water → crown glass.',
    setup: { n1: 1.33, n2: 1.52, theta1: 30 },
    predictionPrompt: 'Is sin θ₂ / sin θ₁ constant as θ₁ changes?',
    procedure: [
      'For θ₁ = 10°, 30°, 60°, compute n₁ sin θ₁ and n₂ sin θ₂ from the readouts.',
      'Confirm equality (the “Snell check” measurement does this live).',
    ],
    observe: 'The invariant n₁ sin θ₁ across angles.',
    conclusionPrompt: 'Why does this invariant express Fermat’s principle (least time)?',
  },
  {
    id: 'g3',
    title: 'Approaching the critical condition',
    objective: 'Watch θ₂ approach 90° as the dense→rare case steepens.',
    setupLabel: 'Glass → air.',
    setup: { n1: 1.52, n2: 1.0, theta1: 25 },
    predictionPrompt: 'What is the largest θ₂ possible, and at which θ₁ is it reached?',
    procedure: [
      'Increase θ₁ slowly toward 45°.',
      'Note θ₂ → 90° and the critical angle readout.',
      'Continue past it and open the TIR lab to see what happens next.',
    ],
    observe: 'θ₂(θ₁) approaching 90°, then the TIR switch.',
    conclusionPrompt: 'Connect the limiting behavior to θ_c = arcsin(n₂/n₁).',
  },
];

/** §35.5 — Analysis model: wave under refraction. */
export default function RefractionLab() {
  const { params, setParam, applyParams } = useLabParams<RefractionParams>(
    'ray-optics',
    'refraction',
    DEFAULTS,
    RANGES,
  );
  const { n1, n2, theta1, showReflected } = params;
  const svgRef = useRef<SVGSVGElement>(null);

  const solution = useMemo(() => refract(n1, n2, degToRad(theta1)), [n1, n2, theta1]);
  const theta2Deg = solution.theta2 !== null ? radToDeg(solution.theta2) : null;

  const geom = useMemo(() => {
    // Normal points up (into medium 1). Incident from upper-left.
    const t1 = degToRad(theta1);
    const S = { x: H.x - R * Math.sin(t1), y: H.y - R * Math.cos(t1) };
    const reflEnd = { x: H.x + R * Math.sin(t1), y: H.y - R * Math.cos(t1) };
    const t2 = solution.theta2 ?? 0;
    const refrEnd = { x: H.x + R * Math.sin(t2), y: H.y + R * Math.cos(t2) };
    return { S, reflEnd, refrEnd };
  }, [theta1, solution.theta2]);

  const onDragHandle = useCallback(
    (p: { x: number; y: number }) => {
      const dx = H.x - p.x;
      const dy = H.y - p.y;
      if (dy <= 0.001) return; // keep the source in the upper half-plane
      const ang = (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
      setParam('theta1', Math.max(0, Math.min(85, Math.round(ang * 10) / 10)));
    },
    [setParam],
  );

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'n₁ (incident medium)', value: formatValue(n1, 2) },
      { label: 'n₂ (transmitting medium)', value: formatValue(n2, 2) },
      { label: 'θ₁ (from normal)', value: formatValue(theta1, 1), unit: '°', tone: 'accent' },
      {
        label: 'θ₂ (from normal)',
        value: theta2Deg !== null ? formatValue(theta2Deg, 4) : '— none (TIR)',
        unit: theta2Deg !== null ? '°' : undefined,
        tone: theta2Deg !== null ? 'accent' : 'red',
      },
      { label: 'v₁ = c/n₁', value: formatValue(lightSpeedInMedium(n1) / 1e8, 3), unit: '×10⁸ m/s' },
      { label: 'v₂ = c/n₂', value: formatValue(lightSpeedInMedium(n2) / 1e8, 3), unit: '×10⁸ m/s' },
      {
        label: 'Snell check n₁sinθ₁',
        value: formatValue(n1 * Math.sin(degToRad(theta1)), 4),
        tone: 'green',
        title: 'Must equal n₂ sin θ₂ when a refracted ray exists',
      },
      {
        label: 'Critical angle θc',
        value: solution.criticalAngle !== null ? formatValue(radToDeg(solution.criticalAngle), 2) : 'not defined (n₁ ≤ n₂)',
        unit: solution.criticalAngle !== null ? '°' : undefined,
        tone: 'amber',
      },
      {
        label: 'Bending',
        value:
          theta2Deg === null
            ? 'total internal reflection'
            : theta1 === 0
              ? 'straight through'
              : theta2Deg < theta1
                ? 'toward normal (n₂ > n₁)'
                : 'away from normal (n₂ < n₁)',
      },
    ],
    [n1, n2, theta1, theta2Deg, solution.criticalAngle],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'snell',
        tex: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2',
        caption: 'Snell’s law. Angles are measured from the normal. If n₁ sin θ₁ / n₂ exceeds 1 there is no propagating refracted ray (see §35.8).',
        variables: [
          { sym: 'n_1', name: 'index of medium 1', unit: `— (now ${formatValue(n1, 2)})` },
          { sym: 'n_2', name: 'index of medium 2', unit: `— (now ${formatValue(n2, 2)})` },
          { sym: '\\theta_1', name: 'angle of incidence', unit: `° (now ${formatValue(theta1, 1)})` },
          { sym: '\\theta_2', name: 'angle of refraction', unit: theta2Deg !== null ? `° (now ${formatValue(theta2Deg, 2)})` : '° (none — TIR)' },
        ],
        substitutedTex:
          theta2Deg !== null
            ? `\\sin\\theta_2 = \\frac{${formatValue(n1, 2)}}{${formatValue(n2, 2)}}\\sin ${formatValue(theta1, 1)}^\\circ = ${formatValue(solution.sinTheta2, 4)} \\Rightarrow \\theta_2 = ${formatValue(theta2Deg, 2)}^\\circ`
            : `\\sin\\theta_2 = ${formatValue(solution.sinTheta2, 3)} > 1 \\;\\Rightarrow\\; \\text{no refracted ray — total internal reflection}`,
      },
      {
        id: 'index-speed',
        tex: 'n = \\frac{c}{v},\\qquad c = 2.998\\times10^8\\ \\mathrm{m/s}',
        substitutedTex: `v_1 = ${formatValue(lightSpeedInMedium(n1) / 1e8, 3)}\\times10^8\\ \\mathrm{m/s},\\quad v_2 = ${formatValue(lightSpeedInMedium(n2) / 1e8, 3)}\\times10^8\\ \\mathrm{m/s}`,
      },
    ],
    [n1, n2, theta1, theta2Deg, solution.sinTheta2],
  );

  const predictions = useMemo<PredictionScenario<RefractionParams>[]>(
    () => [
      {
        id: 'denser',
        changeLabel: 'Increase n₂',
        promptTex: 'The second medium is made optically denser ($n_2: 1.5 \\to 2.4$) at fixed $\\theta_1$. What happens to $\\theta_2$?',
        options: [
          { id: 'smaller', label: 'θ₂ gets smaller (bends more toward the normal)' },
          { id: 'bigger', label: 'θ₂ gets bigger' },
          { id: 'same', label: 'θ₂ stays the same' },
        ],
        evaluate: (p) => {
          const before = refract(p.n1, 1.5, degToRad(p.theta1));
          const after = refract(p.n1, 2.4, degToRad(p.theta1));
          const t2b = before.theta2 !== null ? radToDeg(before.theta2) : NaN;
          const t2a = after.theta2 !== null ? radToDeg(after.theta2) : NaN;
          return {
            correctOptionId: 'smaller',
            explanation: `Computed with Snell’s law at $\\theta_1 = ${formatValue(p.theta1, 1)}^\\circ$: $\\theta_2 = ${formatValue(t2b, 2)}^\\circ$ (n₂ = 1.5) → ${formatValue(t2a, 2)}^\\circ$ (n₂ = 2.4). Larger n₂ means slower light and a ray closer to the normal.`,
            applyTo: (q) => ({ ...q, n2: 2.4 }),
          };
        },
      },
      {
        id: 'steepen',
        changeLabel: 'Steepen θ₁ (glass→air)',
        promptTex: 'Light goes from glass ($n_1 = 1.52$) to air and $\\theta_1$ is increased toward grazing. What happens?',
        options: [
          { id: 'tir', label: 'θ₂ reaches 90° at θc ≈ 41.1°, then the refracted ray disappears (TIR)' },
          { id: 'grow', label: 'θ₂ keeps growing past 90°' },
          { id: 'shrink', label: 'θ₂ shrinks toward 0' },
        ],
        evaluate: (p) => {
          const sol = refract(1.52, 1.0, degToRad(Math.min(84, p.theta1 + 30)));
          const tc = sol.criticalAngle !== null ? radToDeg(sol.criticalAngle) : NaN;
          return {
            correctOptionId: 'tir',
            explanation: `Computed: $\\theta_c = \\arcsin(1/1.52) = ${formatValue(tc, 2)}^\\circ$. ${sol.totalInternalReflection ? `At the tested angle the model already reports TIR (no refracted ray).` : 'Below θc a refracted ray exists; above it Snell would need sin θ₂ > 1, which is impossible — explore this regime in the §35.8 lab.'}`,
            applyTo: (q) => ({ ...q, n1: 1.52, n2: 1.0, theta1: Math.min(84, q.theta1 + 30) }),
          };
        },
      },
    ],
    [],
  );

  const denser = n2 > n1;

  return (
    <LabLayout
      scene={
        <div className="panel scene-2d">
          <div className="panel-title">
            Optical bench — refraction at a plane interface
            <span style={{ flex: 1 }} />
            <span className="scene-chip">
              {solution.totalInternalReflection
                ? 'total internal reflection'
                : solution.atCriticalAngle
                  ? 'critical angle — refracted ray grazes the surface'
                  : denser
                    ? 'entering denser medium → bends toward normal'
                    : n2 < n1
                      ? 'entering rarer medium → bends away from normal'
                      : 'matched indices → no bending'}
            </span>
          </div>
          <svg
            ref={svgRef}
            className="bench-svg"
            viewBox="0 0 640 420"
            role="img"
            aria-label={`Ray diagram: light crosses a flat interface from a medium with index ${formatValue(n1, 2)} into one with index ${formatValue(n2, 2)}, incident at ${formatValue(theta1, 1)} degrees. ${theta2Deg !== null ? `The refracted ray makes ${formatValue(theta2Deg, 2)} degrees with the normal.` : 'No refracted ray exists: total internal reflection.'}`}
          >
            <ArrowDefs id="refr" colors={{ inc: '#22d3ee', refl: '#f87171', refr: '#fbbf24' }} />
            {/* media */}
            <rect x="0" y="0" width="640" height={H.y} fill={denser ? 'rgba(91,140,255,0.05)' : 'rgba(34,211,238,0.06)'} />
            <rect x="0" y={H.y} width="640" height={420 - H.y} fill={denser ? 'rgba(91,140,255,0.16)' : 'rgba(34,211,238,0.05)'} />
            <line x1="0" y1={H.y} x2="640" y2={H.y} stroke="#5c6b8a" strokeWidth="2" />
            <text x="14" y={H.y - 12} fill="#93a0b8" fontSize="13">medium 1 · n₁ = {formatValue(n1, 2)} · v = {formatValue(lightSpeedInMedium(n1) / 1e8, 2)}×10⁸ m/s</text>
            <text x="14" y={H.y + 24} fill="#93a0b8" fontSize="13">medium 2 · n₂ = {formatValue(n2, 2)} · v = {formatValue(lightSpeedInMedium(n2) / 1e8, 2)}×10⁸ m/s</text>
            {/* normal */}
            <line x1={H.x} y1={H.y - 180} x2={H.x} y2={H.y + 180} stroke="#64748b" strokeWidth="1.3" strokeDasharray="6 5" />
            <text x={H.x + 6} y={H.y - 168} fill="#93a0b8" fontSize="11">normal</text>
            {/* angle arcs */}
            {theta1 > 1 && (
              <>
                <path d={arcPath(H.x, H.y, 52, -90 - theta1, -90)} fill="none" stroke="#22d3ee" strokeWidth="1.8" />
                <text x={polar(H.x, H.y, 66, -90 - theta1 / 2).x - 12} y={polar(H.x, H.y, 66, -90 - theta1 / 2).y} fill="#22d3ee" fontSize="12">θ₁</text>
              </>
            )}
            {theta2Deg !== null && theta2Deg > 1 && (
              <>
                <path d={arcPath(H.x, H.y, 52, 90, 90 - theta2Deg)} fill="none" stroke="#fbbf24" strokeWidth="1.8" />
                <text x={polar(H.x, H.y, 66, 90 - theta2Deg / 2).x + 2} y={polar(H.x, H.y, 66, 90 - theta2Deg / 2).y} fill="#fbbf24" fontSize="12">θ₂</text>
              </>
            )}
            {/* critical-angle marker (only meaningful when n1 > n2) */}
            {solution.criticalAngle !== null && (
              <line
                x1={H.x - R * Math.sin(solution.criticalAngle)}
                y1={H.y - R * Math.cos(solution.criticalAngle)}
                x2={H.x}
                y2={H.y}
                stroke="#a78bfa"
                strokeWidth="1.4"
                strokeDasharray="3 4"
              />
            )}
            {/* incident */}
            <line x1={geom.S.x} y1={geom.S.y} x2={H.x} y2={H.y} stroke="#22d3ee" strokeWidth="2.6" markerEnd="url(#refr-inc)" />
            {/* reflected (partial reflection always drawn when enabled) */}
            {showReflected && (
              <line
                x1={H.x}
                y1={H.y}
                x2={geom.reflEnd.x}
                y2={geom.reflEnd.y}
                stroke="#f87171"
                strokeWidth={solution.totalInternalReflection ? 2.6 : 1.6}
                strokeDasharray={solution.totalInternalReflection ? undefined : '5 4'}
                markerEnd="url(#refr-refl)"
              />
            )}
            {/* refracted */}
            {theta2Deg !== null && (
              <line
                x1={H.x}
                y1={H.y}
                x2={geom.refrEnd.x}
                y2={geom.refrEnd.y}
                stroke="#fbbf24"
                strokeWidth={solution.atCriticalAngle ? 1.6 : 2.6}
                strokeDasharray={solution.atCriticalAngle ? '5 4' : undefined}
                markerEnd="url(#refr-refr)"
              />
            )}
            <circle cx={H.x} cy={H.y} r={4} fill="#e9edf7" />
            <text x={geom.S.x - 66} y={geom.S.y - 6} fill="#22d3ee" fontSize="12">incident</text>
            {showReflected && <text x={geom.reflEnd.x + 6} y={geom.reflEnd.y - 4} fill="#f87171" fontSize="12">reflected</text>}
            {theta2Deg !== null && <text x={geom.refrEnd.x + 8} y={geom.refrEnd.y + 4} fill="#fbbf24" fontSize="12">refracted</text>}
            {solution.totalInternalReflection && (
              <text x={H.x - 240} y={H.y + 120} fill="#f87171" fontSize="13" fontWeight="600">
                θ₁ &gt; θc = {formatValue(radToDeg(solution.criticalAngle as number), 1)}° → no refracted ray (TIR)
              </text>
            )}
            <DragHandle
              x={geom.S.x}
              y={geom.S.y}
              color="#22d3ee"
              label="Drag to change the angle of incidence"
              valueText={`${formatValue(theta1, 1)} degrees`}
              onDrag={onDragHandle}
              svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  setParam('theta1', Math.max(0, theta1 - (e.shiftKey ? 5 : 1)));
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setParam('theta1', Math.min(85, theta1 + (e.shiftKey ? 5 : 1)));
                }
              }}
            />
          </svg>
          {solution.totalInternalReflection && (
            <Callout kind="warn">
              <b>No propagating refracted ray.</b> Snell’s law would require sin θ₂ ={' '}
              {formatValue(solution.sinTheta2, 3)} &gt; 1. Because n₁ &gt; n₂ and θ₁ exceeds the
              critical angle θc = {formatValue(radToDeg(solution.criticalAngle as number), 2)}°, all
              the light is reflected — see the <Link to="/ray-optics/tir">Total Internal Reflection
              lab (§35.8)</Link>. The dashed red ray becomes solid to show full reflection.
            </Callout>
          )}
          {solution.atCriticalAngle && (
            <Callout>
              <b>Exactly at the critical angle.</b> The refracted ray grazes the interface
              (θ₂ = 90°) — the limiting case between refraction and total internal reflection.
            </Callout>
          )}
        </div>
      }
      measurements={<Measurements items={measurements} />}
      controls={
        <>
          <div className="field">
            <span className="field-label">Medium 1</span>
            <select className="select" aria-label="Medium 1 material" value={MATERIALS.some((mm) => Math.abs(mm.n - n1) < 0.005) ? n1 : 'custom'} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setParam('n1', v); }}>
              {MATERIALS.map((mm) => (
                <option key={mm.label} value={mm.n}>{mm.label}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          <ParamSlider label="Refractive index n₁" symbol="n₁" value={n1} min={1} max={2.6} step={0.01} onChange={(v) => setParam('n1', v)} />
          <div className="field">
            <span className="field-label">Medium 2</span>
            <select className="select" aria-label="Medium 2 material" value={MATERIALS.some((mm) => Math.abs(mm.n - n2) < 0.005) ? n2 : 'custom'} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setParam('n2', v); }}>
              {MATERIALS.map((mm) => (
                <option key={mm.label} value={mm.n}>{mm.label}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          <ParamSlider label="Refractive index n₂" symbol="n₂" value={n2} min={1} max={2.6} step={0.01} onChange={(v) => setParam('n2', v)} />
          <ParamSlider label="Angle of incidence" symbol="θ₁" unit="°" value={theta1} min={0} max={85} step={0.5} precision={1} onChange={(v) => setParam('theta1', v)} tooltip="Drag the handle on the bench or use arrow keys when focused" />
          <label className="checkbox-row">
            <input type="checkbox" checked={showReflected} onChange={(e) => setParam('showReflected', e.target.checked)} />
            Show reflected ray (dashed = partial, solid = total)
          </label>
          <PresetBar presets={PRESETS} onApply={(p) => applyParams(p.params)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> A light ray crossing a flat boundary between two
            transparent media of refractive indices n₁ and n₂ (§35.5). The transmitted ray changes
            direction because light travels at different speeds in the two media (n = c/v).
          </p>
          <p>
            <b>Convention.</b> All angles are measured from the normal. The violet dashed ray marks
            the critical-angle direction when n₁ &gt; n₂.
          </p>
          <p>
            <b>Honest handling of the limiting case.</b> When n₁ sin θ₁ / n₂ &gt; 1 the model does
            not draw a fake refracted ray — it reports total internal reflection explicitly, with
            the reason. Intensities (Fresnel coefficients) are outside the ray-optics scope of
            PHYS220 and are not simulated: the dashed reflected ray indicates “partial reflection
            occurs” without claiming an intensity value.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      prediction={<PredictionPanel scenarios={predictions} getParams={() => ({ ...params })} applyParams={applyParams} />}
      investigations={<GuidedPanel experiments={GUIDED} onLoad={applyParams} />}
      practice={
        <PracticePanel
          moduleId="ray-optics"
          generate={() => generateQuestion('ray-optics')}
          onLoadToSim={(sp, target) => { if (!target || target === 'refraction') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="ray-optics" tabId="refraction" params={params} defaultName="Refraction bench" />}
    />
  );
}
