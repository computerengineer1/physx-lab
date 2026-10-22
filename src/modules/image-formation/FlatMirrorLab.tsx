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
import { calculateFlatMirrorImage } from '../../physics/mirrors/flat';
import { formatValue } from '../../utils/format';
import { ArrowDefs, DragHandle } from '../ray-optics/opticsSvg';

interface FlatParams {
  do: number; // object distance [m]
  ho: number; // object height [m]
  showRays: boolean;
}

const DEFAULTS: FlatParams = { do: 1.2, ho: 0.5, showRays: true };
const RANGES = { do: { min: 0.2, max: 2.4 }, ho: { min: 0.1, max: 1.1 } };

const S = 95; // px per metre
const MIRROR_X = 350;
const AXIS_Y = 265;
const EYE1 = { x: 95, y: 150 };
const EYE2 = { x: 95, y: 172 };

const PRESETS: Preset<FlatParams>[] = [
  { id: 'default', label: 'Default', params: { ...DEFAULTS } },
  { id: 'close', label: 'Object close to mirror', params: { do: 0.4, ho: 0.5, showRays: true } },
  { id: 'far', label: 'Object far from mirror', params: { do: 2.2, ho: 0.8, showRays: true } },
  { id: 'tall', label: 'Tall object', params: { do: 1.0, ho: 1.0, showRays: true } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Image distance tracks object distance',
    objective: 'Verify dᵢ = −dₒ as the object moves.',
    setupLabel: 'Default.',
    setup: { do: 1.2, ho: 0.5 },
    predictionPrompt: 'If the object moves 0.5 m closer to the mirror, how far does the image move?',
    procedure: [
      'Drag the object toward the mirror by a chosen amount.',
      'Read dₒ and dᵢ before and after.',
      'Check the dashed extensions still converge exactly at the image arrow.',
    ],
    observe: '(dₒ, dᵢ) pairs before/after.',
    conclusionPrompt: 'State the flat-mirror image rule including the sign meaning.',
  },
  {
    id: 'g2',
    title: 'Size never changes',
    objective: 'Confirm m = +1 independent of distance.',
    setupLabel: 'Default.',
    setup: { do: 1.2, ho: 0.5 },
    predictionPrompt: 'Does walking away from a mirror shrink your image?',
    procedure: [
      'Vary dₒ across its whole range; watch hᵢ and m.',
      'Vary hₒ; watch hᵢ follow exactly.',
    ],
    observe: 'm and hᵢ for several distances.',
    conclusionPrompt: 'Why do mirrors in shops seem to shrink things then? (Angular size vs actual image size.)',
  },
  {
    id: 'g3',
    title: 'Where do the reflected rays appear to come from?',
    objective: 'Connect virtual-image construction to ray extensions.',
    setupLabel: 'Rays visible.',
    setup: { do: 1.0, ho: 0.6, showRays: true },
    predictionPrompt: 'Do the two reflected rays entering the eye converge in front of the mirror?',
    procedure: [
      'Trace the solid reflected rays backward (dashed).',
      'Note where the dashed lines meet — compare with the image arrow.',
      'Move the eye-line implicitly by changing dₒ; the meeting point follows the image.',
    ],
    observe: 'Convergence point of the dashed extensions.',
    conclusionPrompt: 'Explain “virtual”: why no light actually passes through the image point.',
  },
];

/** §36.1 — Images formed by flat mirrors. */
export default function FlatMirrorLab() {
  const { params, setParam, applyParams } = useLabParams<FlatParams>(
    'image-formation',
    'flat',
    DEFAULTS,
    RANGES,
  );
  const { do: dObj, ho, showRays } = params;
  const svgRef = useRef<SVGSVGElement>(null);

  const img = useMemo(() => calculateFlatMirrorImage(dObj, ho), [dObj, ho]);

  const geom = useMemo(() => {
    const objX = MIRROR_X - dObj * S;
    const imgX = MIRROR_X + dObj * S;
    const tipY = AXIS_Y - ho * S;
    const tip = { x: objX, y: tipY };
    const imgTip = { x: imgX, y: tipY };
    // Reflection points: intersect eye→image-tip sight lines with the mirror.
    const reflectPoint = (eye: { x: number; y: number }) => {
      const dx = imgTip.x - eye.x;
      const dy = imgTip.y - eye.y;
      const s = (MIRROR_X - eye.x) / dx;
      return { x: MIRROR_X, y: eye.y + s * dy };
    };
    const M1 = reflectPoint(EYE1);
    const M2 = reflectPoint(EYE2);
    return { objX, imgX, tip, imgTip, M1, M2 };
  }, [dObj, ho]);

  const onDragBase = useCallback(
    (p: { x: number; y: number }) => {
      const d = (MIRROR_X - p.x) / S;
      setParam('do', Math.round(Math.max(RANGES.do.min, Math.min(RANGES.do.max, d)) * 100) / 100);
    },
    [setParam],
  );
  const onDragTip = useCallback(
    (p: { x: number; y: number }) => {
      const h = (AXIS_Y - p.y) / S;
      setParam('ho', Math.round(Math.max(RANGES.ho.min, Math.min(RANGES.ho.max, h)) * 100) / 100);
      const d = (MIRROR_X - p.x) / S;
      setParam('do', Math.round(Math.max(RANGES.do.min, Math.min(RANGES.do.max, d)) * 100) / 100);
    },
    [setParam],
  );

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Object distance dₒ', value: formatValue(img.objectDistance), unit: 'm', tone: 'accent' },
      { label: 'Image distance dᵢ', value: formatValue(img.imageDistance), unit: 'm', tone: 'violet', title: 'Negative ⇒ behind the mirror' },
      { label: 'Magnification m', value: `+${formatValue(img.magnification, 0)}` },
      { label: 'Object height hₒ', value: formatValue(ho), unit: 'm' },
      { label: 'Image height hᵢ', value: formatValue(img.imageHeight), unit: 'm' },
      { label: 'Image type', value: 'virtual (behind mirror)', tone: 'amber' },
      { label: 'Orientation', value: 'upright' },
      { label: 'Size', value: 'same size as object' },
    ],
    [img, ho],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'flat-mirror',
        tex: 'd_i = -d_o,\\qquad m = \\frac{h_i}{h_o} = +1',
        caption: 'Declared convention: distances measured from the mirror; dₒ > 0 in front; dᵢ < 0 behind (virtual). The image is virtual, upright and the same size for any real object position.',
        variables: [
          { sym: 'd_o', name: 'object distance', unit: `m (now ${formatValue(dObj)})` },
          { sym: 'd_i', name: 'image distance', unit: `m (now ${formatValue(img.imageDistance)})` },
        ],
        substitutedTex: `d_i = -(${formatValue(dObj)}) = ${formatValue(img.imageDistance)}\\ \\mathrm{m};\\quad h_i = (+1)\\cdot${formatValue(ho)} = ${formatValue(img.imageHeight)}\\ \\mathrm{m}`,
      },
    ],
    [dObj, ho, img],
  );

  const predictions = useMemo<PredictionScenario<FlatParams>[]>(
    () => [
      {
        id: 'closer',
        changeLabel: 'Move object 0.5 m closer',
        promptTex: 'The object is moved $0.5\\ \\mathrm{m}$ closer to the mirror. How does the image move?',
        options: [
          { id: 'same', label: 'It also moves 0.5 m closer (from the other side) — separation shrinks by 1.0 m' },
          { id: 'stay', label: 'It stays where it is' },
          { id: 'half', label: 'It moves 0.25 m closer' },
        ],
        evaluate: (p) => {
          const d2 = Math.max(RANGES.do.min, p.do - 0.5);
          const sep1 = 2 * p.do;
          const sep2 = 2 * d2;
          return {
            correctOptionId: 'same',
            explanation: `Computed: $d_i = -d_o$ always. Object–image separation is $2d_o$: ${formatValue(sep1)} m → ${formatValue(sep2)} m — it shrinks by ${formatValue(sep1 - sep2)} m, twice the object's move.`,
            applyTo: (q) => ({ ...q, do: d2 }),
          };
        },
      },
      {
        id: 'taller',
        changeLabel: 'Double object height',
        promptTex: 'The object height is doubled. What happens to the magnification $m$?',
        options: [
          { id: 'one', label: 'It stays +1 (hᵢ doubles with hₒ)' },
          { id: 'two', label: 'It becomes +2' },
          { id: 'half', label: 'It becomes +0.5' },
        ],
        evaluate: (p) => {
          const h2 = Math.min(RANGES.ho.max, p.ho * 2);
          const im = calculateFlatMirrorImage(p.do, h2);
          return {
            correctOptionId: 'one',
            explanation: `Computed: $m = -d_i/d_o = +1$ regardless of height; $h_i = ${formatValue(im.imageHeight)}\\ \\mathrm{m}$ for $h_o = ${formatValue(h2)}\\ \\mathrm{m}$. A flat mirror never magnifies.`,
            applyTo: (q) => ({ ...q, ho: h2 }),
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
            Flat-mirror bench — drag the object arrow
            <span style={{ flex: 1 }} />
            <span className="scene-chip">virtual · upright · m = +1</span>
          </div>
          <svg
            ref={svgRef}
            className="bench-svg"
            viewBox="0 0 640 400"
            role="img"
            aria-label={`Flat mirror diagram: object ${formatValue(dObj)} m in front of the mirror, height ${formatValue(ho)} m; virtual upright image ${formatValue(dObj)} m behind the mirror with the same height. Solid rays travel from the object tip to the mirror and on to the observer; dashed extensions behind the mirror meet at the image tip.`}
          >
            <ArrowDefs id="flat" colors={{ ray: '#22d3ee' }} />
            {/* mirror */}
            <line x1={MIRROR_X} y1="40" x2={MIRROR_X} y2="360" stroke="#94a3b8" strokeWidth="4" />
            {Array.from({ length: 9 }, (_, i) => {
              const y = 55 + i * 36;
              return <line key={i} x1={MIRROR_X + 2} y1={y} x2={MIRROR_X + 14} y2={y + 10} stroke="#5c6b8a" strokeWidth="1.6" />;
            })}
            <text x={MIRROR_X - 10} y="34" fill="#93a0b8" fontSize="12" textAnchor="end">mirror surface</text>
            <text x={MIRROR_X + 18} y="34" fill="#64708c" fontSize="11">(silvered side →)</text>
            {/* principal "axis" */}
            <line x1="20" y1={AXIS_Y} x2="620" y2={AXIS_Y} stroke="#3b4a6b" strokeWidth="1" strokeDasharray="2 5" />
            {/* distance markers */}
            <line x1={geom.objX} y1={AXIS_Y + 26} x2={MIRROR_X} y2={AXIS_Y + 26} stroke="#22d3ee" strokeWidth="1.4" markerEnd="url(#flat-ray)" markerStart="url(#flat-ray)" />
            <text x={(geom.objX + MIRROR_X) / 2} y={AXIS_Y + 42} fill="#22d3ee" fontSize="12" textAnchor="middle">dₒ = {formatValue(dObj)} m</text>
            <line x1={MIRROR_X} y1={AXIS_Y + 26} x2={geom.imgX} y2={AXIS_Y + 26} stroke="#a78bfa" strokeWidth="1.4" />
            <text x={(MIRROR_X + geom.imgX) / 2} y={AXIS_Y + 42} fill="#a78bfa" fontSize="12" textAnchor="middle">|dᵢ| = {formatValue(dObj)} m (behind)</text>
            {/* rays */}
            {showRays && (
              <g>
                {[geom.M1, geom.M2].map((M, i) => (
                  <g key={i}>
                    <line x1={geom.tip.x} y1={geom.tip.y} x2={M.x} y2={M.y} stroke="#22d3ee" strokeWidth="2" markerEnd="url(#flat-ray)" />
                    <line x1={M.x} y1={M.y} x2={i === 0 ? EYE1.x : EYE2.x} y2={i === 0 ? EYE1.y : EYE2.y} stroke="#22d3ee" strokeWidth="2" markerEnd="url(#flat-ray)" />
                    <line x1={M.x} y1={M.y} x2={geom.imgTip.x} y2={geom.imgTip.y} stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="5 4" />
                  </g>
                ))}
                {/* observer */}
                <circle cx={EYE1.x - 12} cy={(EYE1.y + EYE2.y) / 2} r="12" fill="none" stroke="#93a0b8" strokeWidth="1.6" />
                <circle cx={EYE1.x - 12} cy={(EYE1.y + EYE2.y) / 2} r="4" fill="#93a0b8" />
                <text x={EYE1.x - 34} y={(EYE1.y + EYE2.y) / 2 + 28} fill="#93a0b8" fontSize="11">observer</text>
              </g>
            )}
            {/* object arrow (solid) */}
            <line x1={geom.objX} y1={AXIS_Y} x2={geom.tip.x} y2={geom.tip.y} stroke="#f472b6" strokeWidth="3.4" />
            <polygon points={`${geom.tip.x},${geom.tip.y - 9} ${geom.tip.x - 5},${geom.tip.y + 2} ${geom.tip.x + 5},${geom.tip.y + 2}`} fill="#f472b6" />
            <text x={geom.objX - 8} y={AXIS_Y + 16} fill="#f472b6" fontSize="12" textAnchor="end">object hₒ</text>
            {/* image arrow (dashed, behind) */}
            <line x1={geom.imgX} y1={AXIS_Y} x2={geom.imgTip.x} y2={geom.imgTip.y} stroke="#a78bfa" strokeWidth="3" strokeDasharray="6 4" />
            <polygon points={`${geom.imgTip.x},${geom.imgTip.y - 9} ${geom.imgTip.x - 5},${geom.imgTip.y + 2} ${geom.imgTip.x + 5},${geom.imgTip.y + 2}`} fill="#a78bfa" />
            <text x={geom.imgX + 8} y={AXIS_Y + 16} fill="#a78bfa" fontSize="12">image hᵢ (virtual)</text>
            {/* drag handles */}
            <DragHandle x={geom.objX} y={AXIS_Y} color="#f472b6" label="Drag to change the object distance" valueText={`${formatValue(dObj)} metres in front of the mirror`} onDrag={onDragBase} svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); setParam('do', Math.min(RANGES.do.max, dObj + 0.05)); }
                if (e.key === 'ArrowRight') { e.preventDefault(); setParam('do', Math.max(RANGES.do.min, dObj - 0.05)); }
              }} />
            <DragHandle x={geom.tip.x} y={geom.tip.y} color="#fbbf24" label="Drag the object tip to change its height" valueText={`${formatValue(ho)} metres tall`} onDrag={onDragTip} svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); setParam('ho', Math.min(RANGES.ho.max, ho + 0.05)); }
                if (e.key === 'ArrowDown') { e.preventDefault(); setParam('ho', Math.max(RANGES.ho.min, ho - 0.05)); }
              }} />
          </svg>
        </div>
      }
      measurements={<Measurements items={measurements} />}
      controls={
        <>
          <ParamSlider label="Object distance" symbol="dₒ" unit="m" value={dObj} min={0.2} max={2.4} step={0.01} onChange={(v) => setParam('do', v)} tooltip="Distance from the object to the mirror surface. Drag the pink handle on the bench." />
          <ParamSlider label="Object height" symbol="hₒ" unit="m" value={ho} min={0.1} max={1.1} step={0.01} onChange={(v) => setParam('ho', v)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={showRays} onChange={(e) => setParam('showRays', e.target.checked)} />
            Show observer rays &amp; virtual extensions
          </label>
          <PresetBar presets={PRESETS} onApply={(p) => applyParams(p.params)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Image formation by a plane (flat) mirror (§36.1). Light
            rays from the object tip reflect at the surface; the observer’s eye traces them back
            along straight lines, which meet at a point <i>behind</i> the mirror — the virtual
            image.
          </p>
          <p>
            <b>Sign convention (declared).</b> Distances are measured from the mirror: real objects
            in front have dₒ &gt; 0; images behind the mirror have dᵢ &lt; 0. For a flat mirror
            dᵢ = −dₒ and m = +1 always.
          </p>
          <p>
            <b>Virtual ≠ unreal.</b> No light passes through the image point — the dashed lines are
            geometric extensions of real reflected rays. The image cannot be projected on a screen,
            but your eye/brain perceives it exactly where the extensions meet.
          </p>
          <p>
            <b>Model constraint.</b> The object and image can never be moved independently: the
            image is computed from dₒ and hₒ through calculateFlatMirrorImage — the single source
            of truth also used by tests and practice questions.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      prediction={<PredictionPanel scenarios={predictions} getParams={() => ({ ...params })} applyParams={applyParams} />}
      investigations={<GuidedPanel experiments={GUIDED} onLoad={applyParams} />}
      practice={
        <PracticePanel
          moduleId="image-formation"
          generate={() => generateQuestion('image-formation')}
          onLoadToSim={(sp, target) => { if (!target || target === 'flat') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="image-formation" tabId="flat" params={params} defaultName="Flat mirror" />}
    />
  );
}
