import { useCallback, useMemo, useRef } from 'react';
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
import { criticalAngle, degToRad, radToDeg, refract } from '../../physics/optics/rays';
import { formatValue } from '../../utils/format';
import { ArrowDefs, DragHandle, arcPath } from '../ray-optics/opticsSvg';

interface TirParams {
  n1: number;
  n2: number;
  theta1: number; // deg
}

const DEFAULTS: TirParams = { n1: 1.5, n2: 1.0, theta1: 30 };
const RANGES = {
  n1: { min: 1, max: 2.6 },
  n2: { min: 1, max: 2.6 },
  theta1: { min: 0, max: 85 },
};

const H = { x: 320, y: 210 };
const R = 170;

const PRESETS: Preset<TirParams>[] = [
  { id: 'glass-air-below', label: 'Glass→air, below θc', params: { n1: 1.5, n2: 1.0, theta1: 25 } },
  { id: 'glass-air-at', label: 'Glass→air, at θc', params: { n1: 1.5, n2: 1.0, theta1: 41.8 } },
  { id: 'glass-air-above', label: 'Glass→air, above θc', params: { n1: 1.5, n2: 1.0, theta1: 60 } },
  { id: 'water-air', label: 'Water→air', params: { n1: 1.33, n2: 1.0, theta1: 55 } },
  { id: 'impossible', label: 'Air→glass (TIR impossible)', params: { n1: 1.0, n2: 1.5, theta1: 60 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Find the critical angle by hand',
    objective: 'Locate θc experimentally and compare with arcsin(n₂/n₁).',
    setupLabel: 'Glass (1.50) → air (1.00).',
    setup: { n1: 1.5, n2: 1.0, theta1: 20 },
    predictionPrompt: 'Compute θc = arcsin(1/1.5) before sweeping. About 41.8°?',
    procedure: [
      'Increase θ₁ slowly with the slider or by dragging the ray handle.',
      'Find where the refracted ray first disappears.',
      'Use the “at θc” quick button to jump exactly to the computed value and compare.',
    ],
    observe: 'θ₁ at which TIR switches on vs the computed θc.',
    conclusionPrompt: 'Why exactly 90° refraction at θc, and nothing beyond?',
  },
  {
    id: 'g2',
    title: 'Which pairs can totally internally reflect?',
    objective: 'Confirm TIR requires n₁ > n₂.',
    setupLabel: 'Start from glass→air.',
    setup: { n1: 1.5, n2: 1.0, theta1: 60 },
    predictionPrompt: 'Can air→glass ever totally internally reflect, at any angle?',
    procedure: [
      'With θ₁ = 60°, note the TIR state for glass→air.',
      'Swap the indices (air→glass) and sweep θ₁ up to 85°.',
      'Read the critical-angle measurement: “not defined”.',
    ],
    observe: 'Presence/absence of TIR and the θc readout in both configurations.',
    conclusionPrompt: 'Explain with sin θ₂ = (n₁/n₂) sin θ₁: when can it exceed 1?',
  },
  {
    id: 'g3',
    title: 'Diamond brilliance and optical fibres',
    objective: 'Connect a small θc to real applications.',
    setupLabel: 'Diamond (2.42) → air.',
    setup: { n1: 2.42, n2: 1.0, theta1: 30 },
    predictionPrompt: 'Is θc for diamond larger or smaller than 45°?',
    procedure: [
      'Load diamond→air; read θc (≈ 24.4°).',
      'Sweep θ₁ and note how wide the TIR zone is (everything above 24.4°).',
      'Compare with glass→air (TIR only above ≈ 41.8°).',
    ],
    observe: 'θc values and TIR zone widths for both materials.',
    conclusionPrompt: 'Why does a small θc make diamonds sparkle and fibre optics work?',
  },
];

/** §35.8 — Total internal reflection. */
export default function TotalInternalReflectionLab() {
  const { params, setParam, applyParams } = useLabParams<TirParams>(
    'ray-optics',
    'tir',
    DEFAULTS,
    RANGES,
  );
  const { n1, n2, theta1 } = params;
  const svgRef = useRef<SVGSVGElement>(null);

  const solution = useMemo(() => refract(n1, n2, degToRad(theta1)), [n1, n2, theta1]);
  const tc = useMemo(() => criticalAngle(n1, n2), [n1, n2]);
  const tirPossible = tc !== null;
  const theta2Deg = solution.theta2 !== null ? radToDeg(solution.theta2) : null;

  const zone = !tirPossible
    ? 'TIR impossible (n₁ ≤ n₂)'
    : solution.totalInternalReflection
      ? 'ABOVE θc — total internal reflection'
      : solution.atCriticalAngle
        ? 'AT θc — refracted ray grazes the surface'
        : 'BELOW θc — ordinary refraction (+ partial reflection)';

  const geom = useMemo(() => {
    const t1 = degToRad(theta1);
    const S = { x: H.x - R * Math.sin(t1), y: H.y - R * Math.cos(t1) };
    const reflEnd = { x: H.x + R * Math.sin(t1), y: H.y - R * Math.cos(t1) };
    const t2 = solution.theta2 ?? Math.PI / 2;
    const refrEnd = { x: H.x + R * Math.sin(t2), y: H.y + R * Math.cos(t2) };
    const critEnd =
      tc !== null
        ? { x: H.x - R * Math.sin(tc), y: H.y - R * Math.cos(tc) }
        : null;
    return { S, reflEnd, refrEnd, critEnd };
  }, [theta1, solution.theta2, tc]);

  const onDragHandle = useCallback(
    (p: { x: number; y: number }) => {
      const dx = H.x - p.x;
      const dy = H.y - p.y;
      if (dy <= 0.001) return;
      const ang = (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
      setParam('theta1', Math.max(0, Math.min(85, Math.round(ang * 10) / 10)));
    },
    [setParam],
  );

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'n₁ (denser side?)', value: formatValue(n1, 2) },
      { label: 'n₂', value: formatValue(n2, 2) },
      {
        label: 'Critical angle θc',
        value: tc !== null ? formatValue(radToDeg(tc), 4) : 'not defined',
        unit: tc !== null ? '°' : undefined,
        tone: 'amber',
        title: tc === null ? 'θc = arcsin(n₂/n₁) requires n₁ > n₂' : 'arcsin(n₂/n₁)',
      },
      { label: 'θ₁', value: formatValue(theta1, 1), unit: '°', tone: 'accent' },
      {
        label: 'θ₂',
        value: theta2Deg !== null ? formatValue(theta2Deg, 2) : '— (none)',
        unit: theta2Deg !== null ? '°' : undefined,
      },
      {
        label: 'Regime',
        value: solution.totalInternalReflection
          ? 'TIR'
          : solution.atCriticalAngle
            ? 'critical'
            : tirPossible
              ? 'refracting'
              : 'refracting (TIR impossible)',
        tone: solution.totalInternalReflection ? 'red' : solution.atCriticalAngle ? 'amber' : 'green',
      },
      {
        label: 'Margin θ₁ − θc',
        value: tc !== null ? formatValue(theta1 - radToDeg(tc), 1) : '—',
        unit: tc !== null ? '°' : undefined,
      },
    ],
    [n1, n2, tc, theta1, theta2Deg, solution, tirPossible],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'critical-angle',
        tex: '\\theta_c = \\arcsin\\!\\left(\\frac{n_2}{n_1}\\right)\\quad (n_1 > n_2)',
        caption: 'The critical angle exists only when light travels from the optically denser medium into the rarer one.',
        variables: [
          { sym: 'n_1', name: 'index of incidence medium', unit: `— (now ${formatValue(n1, 2)})` },
          { sym: 'n_2', name: 'index of second medium', unit: `— (now ${formatValue(n2, 2)})` },
          { sym: '\\theta_c', name: 'critical angle', unit: tc !== null ? `° (now ${formatValue(radToDeg(tc), 2)})` : 'undefined for this pair' },
        ],
        substitutedTex:
          tc !== null
            ? `\\theta_c = \\arcsin(${formatValue(n2, 2)}/${formatValue(n1, 2)}) = ${formatValue(radToDeg(tc), 2)}^\\circ;\\quad \\theta_1 ${solution.totalInternalReflection ? '>' : solution.atCriticalAngle ? '=' : '<'} \\theta_c \\Rightarrow ${solution.totalInternalReflection ? '\\text{TIR}' : solution.atCriticalAngle ? '\\theta_2 = 90^\\circ' : '\\text{refraction}'}`
            : `n_1 \\le n_2 \\Rightarrow \\text{no } \\theta_c:\\ \\sin\\theta_2 = \\tfrac{n_1}{n_2}\\sin\\theta_1 \\le 1 \\text{ always}`,
      },
      {
        id: 'snell',
        tex: '\\sin\\theta_2 = \\frac{n_1}{n_2}\\sin\\theta_1 \\;\\; (>1 \\Rightarrow \\text{no refracted ray})',
        substitutedTex: `\\sin\\theta_2 = ${formatValue(solution.sinTheta2, 4)}${solution.sinTheta2 > 1 ? ' > 1 \\;\\Rightarrow\\; \\text{total internal reflection}' : ''}`,
      },
    ],
    [n1, n2, tc, solution],
  );

  const predictions = useMemo<PredictionScenario<TirParams>[]>(
    () => [
      {
        id: 'raise-n1',
        changeLabel: 'Raise n₁ (1.5 → 2.4)',
        promptTex: 'The denser medium is swapped from glass (1.50) to diamond (2.42), $n_2$ fixed at air. What happens to $\\theta_c$?',
        options: [
          { id: 'smaller', label: 'θc gets smaller (TIR zone widens)' },
          { id: 'bigger', label: 'θc gets bigger' },
          { id: 'same', label: 'θc stays the same' },
        ],
        evaluate: (p) => {
          const before = criticalAngle(p.n1, p.n2);
          const after = criticalAngle(2.42, p.n2);
          return {
            correctOptionId: 'smaller',
            explanation: `Computed: $\\theta_c$ = ${before !== null ? formatValue(radToDeg(before), 2) : 'undefined'}° → ${after !== null ? formatValue(radToDeg(after), 2) : 'undefined'}°. Larger $n_1/n_2$ ratio ⇒ smaller $\\arcsin(n_2/n_1)$ ⇒ TIR kicks in at shallower angles (this is why cut diamonds trap and re-emit so much light).`,
            applyTo: (q) => ({ ...q, n1: 2.42 }),
          };
        },
      },
      {
        id: 'swap',
        changeLabel: 'Swap the media',
        promptTex: 'The two media are swapped so light now enters the DENSER medium. Can total internal reflection still occur?',
        options: [
          { id: 'no', label: 'No — TIR requires n₁ > n₂' },
          { id: 'yes', label: 'Yes, at large angles' },
          { id: 'sometimes', label: 'Only at exactly 45°' },
        ],
        evaluate: (p) => {
          const afterTc = criticalAngle(p.n2, p.n1);
          const explanation =
            afterTc === null
              ? `Computed after swapping: light now enters the denser medium ($n_1' = ${formatValue(p.n2, 2)} < n_2' = ${formatValue(p.n1, 2)}$), so $\\theta_c$ is undefined. Since $\\sin\\theta_2 = (n_1/n_2)\\sin\\theta_1 \\le \\sin\\theta_1 < 1$ for every $\\theta_1 < 90^\\circ$, a refracted ray always exists — TIR is impossible.`
              : `Note: with the current pair TIR was already impossible ($n_1 \\le n_2$); after swapping, $n_1' > n_2'$ and $\\theta_c = ${formatValue(radToDeg(afterTc), 2)}^\\circ$ exists. The rule stands: TIR only occurs while travelling inside the denser medium.`;
          return {
            correctOptionId: 'no',
            explanation,
            applyTo: (q) => ({ ...q, n1: q.n2, n2: q.n1 }),
          };
        },
      },
    ],
    [],
  );

  const quick = (target: 'below' | 'at' | 'above') => {
    if (tc === null) return;
    const tcd = radToDeg(tc);
    const map = { below: tcd - 10, at: tcd, above: Math.min(85, tcd + 10) };
    setParam('theta1', Math.max(0, Math.round(map[target] * 10) / 10));
  };

  return (
    <LabLayout
      scene={
        <div className="panel scene-2d">
          <div className="panel-title">
            Critical-angle bench — total internal reflection
            <span style={{ flex: 1 }} />
            <span className="scene-chip">{zone}</span>
          </div>
          <svg
            ref={svgRef}
            className="bench-svg"
            viewBox="0 0 640 420"
            role="img"
            aria-label={`Critical angle experiment: light in medium 1 (n=${formatValue(n1, 2)}) meets medium 2 (n=${formatValue(n2, 2)}) at ${formatValue(theta1, 1)} degrees. ${tc !== null ? `Critical angle ${formatValue(radToDeg(tc), 1)} degrees. ` : 'No critical angle exists for this pair. '}${solution.totalInternalReflection ? 'Total internal reflection: only the reflected ray exists.' : theta2Deg !== null ? `A refracted ray exists at ${formatValue(theta2Deg, 1)} degrees.` : ''}`}
          >
            <ArrowDefs id="tir" colors={{ inc: '#22d3ee', refl: '#f87171', refr: '#fbbf24' }} />
            <rect x="0" y="0" width="640" height={H.y} fill="rgba(91,140,255,0.14)" />
            <rect x="0" y={H.y} width="640" height={420 - H.y} fill="rgba(34,211,238,0.05)" />
            <line x1="0" y1={H.y} x2="640" y2={H.y} stroke="#5c6b8a" strokeWidth="2" />
            <text x="14" y={H.y - 12} fill="#93a0b8" fontSize="13">medium 1 · n₁ = {formatValue(n1, 2)}</text>
            <text x="14" y={H.y + 24} fill="#93a0b8" fontSize="13">medium 2 · n₂ = {formatValue(n2, 2)}</text>
            <line x1={H.x} y1={H.y - 185} x2={H.x} y2={H.y + 185} stroke="#64748b" strokeWidth="1.3" strokeDasharray="6 5" />
            {/* critical angle marker */}
            {geom.critEnd && (
              <>
                <line x1={geom.critEnd.x} y1={geom.critEnd.y} x2={H.x} y2={H.y} stroke="#a78bfa" strokeWidth="1.6" strokeDasharray="4 4" />
                <text x={geom.critEnd.x - 44} y={geom.critEnd.y - 6} fill="#a78bfa" fontSize="12">
                  θc = {formatValue(radToDeg(tc as number), 1)}°
                </text>
                {/* grazing refracted ray at θc */}
                <line x1={H.x} y1={H.y} x2={H.x + R} y2={H.y} stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="3 4" />
              </>
            )}
            {theta1 > 1 && (
              <path d={arcPath(H.x, H.y, 52, -90 - theta1, -90)} fill="none" stroke="#22d3ee" strokeWidth="1.8" />
            )}
            {theta2Deg !== null && theta2Deg > 1 && theta2Deg < 89.5 && (
              <path d={arcPath(H.x, H.y, 52, 90, 90 - theta2Deg)} fill="none" stroke="#fbbf24" strokeWidth="1.8" />
            )}
            <line x1={geom.S.x} y1={geom.S.y} x2={H.x} y2={H.y} stroke="#22d3ee" strokeWidth="2.6" markerEnd="url(#tir-inc)" />
            <line
              x1={H.x}
              y1={H.y}
              x2={geom.reflEnd.x}
              y2={geom.reflEnd.y}
              stroke="#f87171"
              strokeWidth={solution.totalInternalReflection ? 2.8 : 1.5}
              strokeDasharray={solution.totalInternalReflection ? undefined : '5 4'}
              markerEnd="url(#tir-refl)"
            />
            {theta2Deg !== null && (
              <line
                x1={H.x}
                y1={H.y}
                x2={geom.refrEnd.x}
                y2={geom.refrEnd.y}
                stroke="#fbbf24"
                strokeWidth={solution.atCriticalAngle ? 1.5 : 2.6}
                strokeDasharray={solution.atCriticalAngle ? '5 4' : undefined}
                markerEnd="url(#tir-refr)"
              />
            )}
            <circle cx={H.x} cy={H.y} r={4} fill="#e9edf7" />
            <text x={geom.S.x - 62} y={geom.S.y - 6} fill="#22d3ee" fontSize="12">incident</text>
            <text x={geom.reflEnd.x + 6} y={geom.reflEnd.y - 4} fill="#f87171" fontSize="12">
              reflected{solution.totalInternalReflection ? ' (total)' : ' (partial)'}
            </text>
            {theta2Deg !== null && !solution.atCriticalAngle && (
              <text x={geom.refrEnd.x + 8} y={geom.refrEnd.y + 4} fill="#fbbf24" fontSize="12">refracted</text>
            )}
            {solution.atCriticalAngle && (
              <text x={H.x + R * 0.4} y={H.y + 18} fill="#a78bfa" fontSize="12">grazing (θ₂ = 90°)</text>
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
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" disabled={!tirPossible} onClick={() => quick('below')}>
              Jump to θc − 10°
            </button>
            <button type="button" className="btn sm" disabled={!tirPossible} onClick={() => quick('at')}>
              Jump to θc
            </button>
            <button type="button" className="btn sm" disabled={!tirPossible} onClick={() => quick('above')}>
              Jump to θc + 10°
            </button>
            {!tirPossible && (
              <span className="unit-tag">buttons need n₁ &gt; n₂</span>
            )}
          </div>
          {!tirPossible && (
            <Callout kind="warn">
              <b>Total internal reflection is impossible in this configuration.</b> TIR requires
              light to travel from the optically denser medium into the rarer one (n₁ &gt; n₂), so
              that sin θ₂ = (n₁/n₂) sin θ₁ can exceed 1. With n₁ = {formatValue(n1, 2)} ≤ n₂ ={' '}
              {formatValue(n2, 2)}, sin θ₂ stays ≤ sin θ₁ &lt; 1 for every θ₁ &lt; 90°: a refracted
              ray always exists. Swap the media (preset “Air→glass” shows exactly this) or increase
              n₁ above n₂ to unlock the critical-angle experiment.
            </Callout>
          )}
          {solution.totalInternalReflection && tirPossible && (
            <Callout kind="error">
              <b>Total internal reflection.</b> θ₁ = {formatValue(theta1, 1)}° exceeds θc ={' '}
              {formatValue(radToDeg(tc as number), 2)}°. Snell’s law has no real solution
              (sin θ₂ = {formatValue(solution.sinTheta2, 3)} &gt; 1), so the interface reflects 100%
              of the light back into medium 1. Applications: optical fibres, prisms in binoculars,
              diamond brilliance.
            </Callout>
          )}
          {solution.atCriticalAngle && (
            <Callout>
              <b>Exactly at the critical angle.</b> The refracted ray travels along the interface
              (θ₂ = 90°) — the boundary case between refraction and TIR.
            </Callout>
          )}
        </div>
      }
      measurements={<Measurements items={measurements} />}
      controls={
        <>
          <ParamSlider label="Index of medium 1" symbol="n₁" value={n1} min={1} max={2.6} step={0.01} onChange={(v) => setParam('n1', v)} tooltip="The medium the light comes FROM. TIR needs n₁ > n₂." />
          <ParamSlider label="Index of medium 2" symbol="n₂" value={n2} min={1} max={2.6} step={0.01} onChange={(v) => setParam('n2', v)} />
          <ParamSlider label="Angle of incidence" symbol="θ₁" unit="°" value={theta1} min={0} max={85} step={0.5} precision={1} onChange={(v) => setParam('theta1', v)} />
          <PresetBar presets={PRESETS} onApply={(p) => applyParams(p.params)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> The critical-angle experiment of §35.8. When light travels
            from a denser to a rarer medium, Snell’s law stops having a solution once
            n₁ sin θ₁ &gt; n₂: beyond θc = arcsin(n₂/n₁) the interface reflects everything.
          </p>
          <p>
            <b>Honest physics.</b> TIR is only enabled when n₁ &gt; n₂ — otherwise the lab explains
            why the condition fails instead of drawing a fake effect. Exactly at θc the refracted
            ray is shown grazing the surface (θ₂ = 90°), marked as the limiting case it is.
          </p>
          <p>
            <b>Assumptions.</b> Ray optics (wavelength ≪ feature sizes); smooth flat interface;
            lossless media. The evanescent field just beyond the interface is a wave-optics effect
            outside the PHYS220 ray model and is not simulated.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'tir') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="ray-optics" tabId="tir" params={params} defaultName="Critical angle / TIR" />}
    />
  );
}
