import { useCallback, useMemo, useRef } from 'react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
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
import { degToRad, radToDeg, reflectionAngle } from '../../physics/optics/rays';
import { formatValue } from '../../utils/format';
import { ArrowDefs, DragHandle, arcPath, normalize, polar, reflectDirection } from '../ray-optics/opticsSvg';

interface ReflectionParams {
  thetaI: number; // deg, from normal
  tilt: number; // deg, mirror surface tilt
  showNormal: boolean;
  showAngles: boolean;
}

const DEFAULTS: ReflectionParams = { thetaI: 40, tilt: 0, showNormal: true, showAngles: true };
const RANGES = { thetaI: { min: 0, max: 85 }, tilt: { min: -30, max: 30 } };

const H = { x: 320, y: 250 }; // hit point
const R = 190; // ray length

const PRESETS: Preset<ReflectionParams>[] = [
  { id: 'normal', label: 'Normal incidence (0°)', params: { ...DEFAULTS, thetaI: 0 } },
  { id: 'fortyfive', label: '45° incidence', params: { ...DEFAULTS, thetaI: 45 } },
  { id: 'grazing', label: 'Near-grazing (80°)', params: { ...DEFAULTS, thetaI: 80 } },
  { id: 'tilted', label: 'Tilted mirror (+20°)', params: { ...DEFAULTS, tilt: 20, thetaI: 30 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Verify θᵣ = θᵢ from the normal',
    objective: 'Confirm the law of reflection and that angles are measured from the normal.',
    setupLabel: 'Flat mirror (tilt = 0).',
    setup: { thetaI: 30, tilt: 0 },
    predictionPrompt: 'If θᵢ = 30°, what is the angle between the reflected ray and the mirror SURFACE?',
    procedure: [
      'Set θᵢ to 10°, 30°, 60°; read θᵣ each time.',
      'Compute 90° − θᵣ (angle to the surface) and see why the normal convention matters.',
      'Drag the incident-ray handle and watch both arcs stay equal.',
    ],
    observe: '(θᵢ, θᵣ) pairs and surface-angle complements.',
    conclusionPrompt: 'State the law of reflection precisely, including the reference line.',
  },
  {
    id: 'g2',
    title: 'Tilting the mirror by τ rotates the reflected ray by 2τ',
    objective: 'Discover the double-angle rule for mirror rotation (fixed incident ray).',
    setupLabel: 'θᵢ = 40° from the normal, tilt = 0.',
    setup: { thetaI: 40, tilt: 0 },
    predictionPrompt: 'With the incoming beam fixed in space, tilting the mirror by 10° turns the reflected beam by 10° or 20°?',
    procedure: [
      'Note the reflected ray’s screen direction at tilt = 0.',
      'Set tilt = +10° and observe how far the reflected ray swung on screen.',
      'Compare with the θᵢ/θᵣ readouts (measured from the rotated normal).',
    ],
    observe: 'Screen swing of the reflected ray vs mirror tilt.',
    conclusionPrompt: 'Explain the factor of two: the normal rotates with the mirror, and θᵣ = θᵢ on the other side of it.',
  },
  {
    id: 'g3',
    title: 'Deviation of the beam',
    objective: 'Relate the deviation angle δ = 180° − 2θᵢ to the incidence angle.',
    setupLabel: 'Any.',
    setup: { thetaI: 40, tilt: 0 },
    predictionPrompt: 'At which θᵢ is the beam turned around completely (δ = 180°)?',
    procedure: ['Sweep θᵢ from 0 to 85° and watch δ.', 'Find where δ = 0 and where δ = 180°.'],
    observe: 'δ(θᵢ) behavior at both ends.',
    conclusionPrompt: 'Derive δ = 180° − 2θᵢ geometrically.',
  },
];

/** §35.4 — Analysis model: wave under reflection. */
export default function ReflectionLab() {
  const { params, setParam, applyParams } = useLabParams<ReflectionParams>(
    'ray-optics',
    'reflection',
    DEFAULTS,
    RANGES,
  );
  const { thetaI, tilt, showNormal, showAngles } = params;
  const svgRef = useRef<SVGSVGElement>(null);

  const geom = useMemo(() => {
    const nu = -90 + tilt; // screen angle of the upward unit normal
    const nHat = { x: Math.cos((nu * Math.PI) / 180), y: Math.sin((nu * Math.PI) / 180) };
    const aHS = nu - thetaI; // direction from H toward the source (left of normal)
    const S = polar(H.x, H.y, R, aHS);
    const dIn = normalize({ x: H.x - S.x, y: H.y - S.y });
    const dOut = reflectDirection(dIn, nHat);
    const E = { x: H.x + R * dOut.x, y: H.y + R * dOut.y };
    const aOut = (Math.atan2(dOut.y, dOut.x) * 180) / Math.PI;
    const mirrorEnds = [polar(H.x, H.y, 170, tilt), polar(H.x, H.y, 170, tilt + 180)];
    return { nu, nHat, S, E, aHS, aOut, mirrorEnds };
  }, [thetaI, tilt]);

  const thetaR = useMemo(() => radToDeg(reflectionAngle(degToRad(thetaI))), [thetaI]);
  const deviation = 180 - 2 * thetaI;

  const onDragHandle = useCallback(
    (p: { x: number; y: number }) => {
      const v = normalize({ x: p.x - H.x, y: p.y - H.y });
      const nu = -90 + tilt;
      const nHat = { x: Math.cos((nu * Math.PI) / 180), y: Math.sin((nu * Math.PI) / 180) };
      const dot = Math.max(-1, Math.min(1, v.x * nHat.x + v.y * nHat.y));
      const ang = Math.acos(dot) * (180 / Math.PI);
      setParam('thetaI', Math.max(0, Math.min(85, Math.round(ang * 10) / 10)));
    },
    [tilt, setParam],
  );

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Incidence θᵢ (from normal)', value: formatValue(thetaI, 1), unit: '°', tone: 'accent' },
      { label: 'Reflection θᵣ (from normal)', value: formatValue(thetaR, 1), unit: '°', tone: 'accent' },
      { label: 'Mirror tilt τ', value: formatValue(tilt, 1), unit: '°' },
      { label: 'Deviation δ = 180° − 2θᵢ', value: formatValue(deviation, 1), unit: '°', tone: 'amber' },
      { label: 'Angle to mirror surface', value: formatValue(90 - thetaI, 1), unit: '°' },
    ],
    [thetaI, thetaR, tilt, deviation],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'reflection',
        tex: '\\theta_r = \\theta_i',
        caption: 'Law of reflection: both angles are measured from the NORMAL to the surface (not from the surface itself). Incident ray, reflected ray and normal are coplanar.',
        variables: [
          { sym: '\\theta_i', name: 'angle of incidence', unit: `° (now ${formatValue(thetaI, 1)})` },
          { sym: '\\theta_r', name: 'angle of reflection', unit: `° (now ${formatValue(thetaR, 1)})` },
        ],
        substitutedTex: `\\theta_r = \\theta_i = ${formatValue(thetaI, 1)}^\\circ;\\quad \\delta = 180^\\circ - 2\\theta_i = ${formatValue(deviation, 1)}^\\circ`,
      },
    ],
    [thetaI, thetaR, deviation],
  );

  const predictions = useMemo<PredictionScenario<ReflectionParams>[]>(
    () => [
      {
        id: 'double-theta',
        changeLabel: 'Double θᵢ',
        promptTex: 'The incidence angle is doubled. What happens to $\\theta_r$ and to the deviation $\\delta = 180^\\circ - 2\\theta_i$?',
        options: [
          { id: 'both', label: 'θᵣ doubles too; δ shrinks by twice the added angle' },
          { id: 'same', label: 'θᵣ stays the same' },
          { id: 'half', label: 'θᵣ halves' },
        ],
        evaluate: (p) => {
          const t2 = Math.min(RANGES.thetaI.max, p.thetaI * 2);
          return {
            correctOptionId: 'both',
            explanation: `Computed: $\\theta_r = \\theta_i$: ${formatValue(p.thetaI, 1)}° → ${formatValue(t2, 1)}°; deviation ${formatValue(180 - 2 * p.thetaI, 1)}° → ${formatValue(180 - 2 * t2, 1)}°. The law is linear in the angle — but note the clamp at 85° in this bench.`,
            applyTo: (q) => ({ ...q, thetaI: t2 }),
          };
        },
      },
      {
        id: 'tilt',
        changeLabel: 'Tilt mirror, beam fixed in space',
        promptTex:
          'The mirror is tilted by $+15^\\circ$ while the incident beam stays fixed **in space** (so $\\theta_i$ measured from the rotated normal drops by 15°). By how much does the reflected beam swing on screen?',
        options: [
          { id: '30', label: '30° (twice the tilt)' },
          { id: '15', label: '15° (same as tilt)' },
          { id: '0', label: 'It does not move' },
        ],
        evaluate: (p) => {
          const tau2 = Math.min(RANGES.tilt.max, p.tilt + 15);
          const ti2 = Math.max(RANGES.thetaI.min, p.thetaI - (tau2 - p.tilt));
          const a1 = -90 + p.tilt + p.thetaI; // screen direction of reflected ray before
          const a2 = -90 + tau2 + ti2; // after
          return {
            correctOptionId: '30',
            explanation: `Computed from the model geometry: the reflected ray's screen direction goes from ${formatValue(a1, 1)}° to ${formatValue(a2, 1)}° — a swing of ${formatValue(a2 - a1, 1)}°. The normal rotates with the mirror (+15°), and $\\theta_r = \\theta_i$ is measured on the other side of that rotated normal: the beam-fixed-in-space swing is $2\\tau = 30^\\circ$ (as long as $\\theta_i$ does not hit the 0–85° clamps of this bench).`,
            applyTo: (q) => ({ ...q, tilt: tau2, thetaI: ti2 }),
          };
        },
      },
    ],
    [],
  );

  return (
    <LabLayout
      scene={
        <div className="panel scene-2d">
          <div className="panel-title">
            Optical bench — reflection at a plane mirror
            <span style={{ flex: 1 }} />
            <span className="scene-chip">angles measured from the normal</span>
          </div>
          <svg
            ref={svgRef}
            className="bench-svg"
            viewBox="0 0 640 420"
            role="img"
            aria-label={`Ray diagram: an incident ray strikes a plane mirror at ${formatValue(thetaI, 0)} degrees from the normal and reflects at ${formatValue(thetaR, 0)} degrees on the other side. Mirror tilt ${formatValue(tilt, 0)} degrees.`}
          >
            <ArrowDefs id="refl" colors={{ inc: '#22d3ee', refl: '#fbbf24' }} />
            {/* mirror */}
            <line
              x1={geom.mirrorEnds[0].x}
              y1={geom.mirrorEnds[0].y}
              x2={geom.mirrorEnds[1].x}
              y2={geom.mirrorEnds[1].y}
              stroke="#94a3b8"
              strokeWidth={5}
              strokeLinecap="round"
            />
            {/* hatch marks behind mirror */}
            {Array.from({ length: 9 }, (_, i) => {
              const t = (i - 4) * 40;
              const c = polar(H.x, H.y, Math.abs(t), t >= 0 ? tilt : tilt + 180);
              const back = polar(c.x, c.y, 12, tilt + 115);
              return <line key={i} x1={c.x} y1={c.y} x2={back.x} y2={back.y} stroke="#5c6b8a" strokeWidth={1.6} />;
            })}
            {/* normal */}
            {showNormal && (
              <>
                <line
                  x1={polar(H.x, H.y, 175, geom.nu).x}
                  y1={polar(H.x, H.y, 175, geom.nu).y}
                  x2={polar(H.x, H.y, 120, geom.nu + 180).x}
                  y2={polar(H.x, H.y, 120, geom.nu + 180).y}
                  stroke="#64748b"
                  strokeWidth={1.4}
                  strokeDasharray="6 5"
                />
                <text x={polar(H.x, H.y, 182, geom.nu).x - 8} y={polar(H.x, H.y, 182, geom.nu).y} fill="#93a0b8" fontSize={12}>
                  normal
                </text>
              </>
            )}
            {/* angle arcs */}
            {showAngles && thetaI > 1 && (
              <>
                <path d={arcPath(H.x, H.y, 58, geom.aHS, geom.nu)} fill="none" stroke="#22d3ee" strokeWidth={1.8} />
                <path d={arcPath(H.x, H.y, 58, geom.nu, geom.aOut)} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
                <text {...labelPos(geom.aHS, geom.nu)} fill="#22d3ee" fontSize={13} textAnchor="middle">θᵢ</text>
                <text {...labelPos(geom.nu, geom.aOut)} fill="#fbbf24" fontSize={13} textAnchor="middle">θᵣ</text>
              </>
            )}
            {/* incident ray */}
            <line x1={geom.S.x} y1={geom.S.y} x2={H.x} y2={H.y} stroke="#22d3ee" strokeWidth={2.6} markerEnd="url(#refl-inc)" />
            {/* reflected ray */}
            <line x1={H.x} y1={H.y} x2={geom.E.x} y2={geom.E.y} stroke="#fbbf24" strokeWidth={2.6} markerEnd="url(#refl-refl)" />
            <circle cx={H.x} cy={H.y} r={4} fill="#e9edf7" />
            <text x={H.x + 8} y={H.y + 18} fill="#93a0b8" fontSize={11}>hit point</text>
            <text x={geom.S.x - 60} y={geom.S.y - 8} fill="#22d3ee" fontSize={12}>incident</text>
            <text x={geom.E.x + 6} y={geom.E.y} fill="#fbbf24" fontSize={12}>reflected</text>
            <DragHandle
              x={geom.S.x}
              y={geom.S.y}
              color="#22d3ee"
              label="Drag to change the angle of incidence"
              valueText={`${formatValue(thetaI, 1)} degrees from the normal`}
              onDrag={onDragHandle}
              svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  setParam('thetaI', Math.max(0, thetaI - (e.shiftKey ? 5 : 1)));
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setParam('thetaI', Math.min(85, thetaI + (e.shiftKey ? 5 : 1)));
                }
              }}
            />
          </svg>
        </div>
      }
      measurements={<Measurements items={measurements} />}
      controls={
        <>
          <ParamSlider label="Angle of incidence" symbol="θᵢ" unit="°" value={thetaI} min={0} max={85} step={0.5} precision={1} onChange={(v) => setParam('thetaI', v)} tooltip="Measured from the normal. Drag the handle on the diagram or use arrow keys when it is focused." />
          <ParamSlider label="Mirror tilt" symbol="τ" unit="°" value={tilt} min={-30} max={30} step={0.5} precision={1} onChange={(v) => setParam('tilt', v)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={showNormal} onChange={(e) => setParam('showNormal', e.target.checked)} />
            Show normal line
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={showAngles} onChange={(e) => setParam('showAngles', e.target.checked)} />
            Show angle arcs
          </label>
          <PresetBar presets={PRESETS} onApply={(p) => applyParams(p.params)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Specular reflection of a light ray at a smooth plane
            interface (§35.4). The ray model is valid when the wavelength is much smaller than the
            mirror features.
          </p>
          <p>
            <b>Convention.</b> Both angles are measured from the <i>normal</i> — the line
            perpendicular to the surface at the hit point. The incident ray, reflected ray and
            normal all lie in one plane (the plane of this diagram).
          </p>
          <p>
            <b>Assumptions.</b> Ideal smooth reflector; no absorption or scattering; the reflected
            intensity equals the incident intensity (intensity bookkeeping is outside this model).
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
          onLoadToSim={(sp, target) => { if (!target || target === 'reflection') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="ray-optics" tabId="reflection" params={params} defaultName="Reflection bench" />}
    />
  );
}

function labelPos(a0: number, a1: number) {
  const mid = (a0 + a1) / 2;
  const p = polar(H.x, H.y, 78, mid);
  return { x: p.x, y: p.y };
}
