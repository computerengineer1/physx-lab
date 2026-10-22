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
import {
  calculateSphericalMirrorImage,
  concaveObjectZone,
  describeSphericalMirrorImage,
  focalLengthFromRadius,
} from '../../physics/mirrors/spherical';
import type { MirrorType } from '../../physics/mirrors/spherical';
import { formatValue } from '../../utils/format';
import { DragHandle } from '../ray-optics/opticsSvg';

interface SphereParams {
  mirrorType: string; // 'concave' | 'convex'
  R: number; // radius of curvature magnitude [m]
  do: number; // object distance [m]
  ho: number; // object height [m]
  showRays: boolean;
  showLabels: boolean;
}

const DEFAULTS: SphereParams = { mirrorType: 'concave', R: 0.6, do: 1.0, ho: 0.25, showRays: true, showLabels: true };
const RANGES = {
  R: { min: 0.2, max: 1.2 },
  do: { min: 0.12, max: 3 },
  ho: { min: 0.05, max: 0.5 },
};

const VB = { w: 720, h: 430 };
const Y0 = 218;

const PRESETS: Preset<SphereParams>[] = [
  { id: 'beyondC', label: 'Concave · beyond C', params: { ...DEFAULTS, mirrorType: 'concave', R: 0.6, do: 0.95 } },
  { id: 'atC', label: 'Concave · at C', params: { ...DEFAULTS, mirrorType: 'concave', R: 0.6, do: 0.6 } },
  { id: 'betweenCF', label: 'Concave · between C and F', params: { ...DEFAULTS, mirrorType: 'concave', R: 0.6, do: 0.42 } },
  { id: 'atF', label: 'Concave · at F (singular)', params: { ...DEFAULTS, mirrorType: 'concave', R: 0.6, do: 0.3 } },
  { id: 'insideF', label: 'Concave · inside F', params: { ...DEFAULTS, mirrorType: 'concave', R: 0.6, do: 0.18 } },
  { id: 'convex', label: 'Convex mirror', params: { ...DEFAULTS, mirrorType: 'convex', R: 0.6, do: 0.8 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Walk the object across the focal point (concave)',
    objective: 'Map every image regime of a concave mirror in one sweep.',
    setupLabel: 'Concave, R = 0.6 m (f = 0.3 m), object beyond C.',
    setup: { mirrorType: 'concave', R: 0.6, do: 0.95, ho: 0.25 },
    predictionPrompt: 'At which object distance does the image flip from real/inverted to virtual/upright?',
    procedure: [
      'Drag the object slowly from beyond C toward the mirror.',
      'At each zone (beyond C, at C, between C and F, at F, inside F) record dᵢ, m and the classification.',
      'Pay attention to what happens exactly at dₒ = f.',
    ],
    observe: 'A five-row table of zone → (dᵢ, m, real/virtual, upright/inverted, size).',
    conclusionPrompt: 'Summarize the concave-mirror case table and explain the dₒ = f limit.',
  },
  {
    id: 'g2',
    title: 'Convex mirrors always give the same kind of image',
    objective: 'Test whether any real-object position breaks the virtual/upright/reduced rule.',
    setupLabel: 'Convex, R = 0.6 m.',
    setup: { mirrorType: 'convex', R: 0.6, do: 0.8, ho: 0.25 },
    predictionPrompt: 'Can a convex mirror ever produce a real image of a real object?',
    procedure: [
      'Sweep dₒ from 0.12 m to 3 m.',
      'Watch the classification badge and dᵢ sign.',
      'Check |m| < 1 everywhere.',
    ],
    observe: 'Sign of dᵢ, sign of m, |m| across the sweep.',
    conclusionPrompt: 'Why is f < 0 decisive? Connect to the mirror equation.',
  },
  {
    id: 'g3',
    title: 'Principal rays locate the same image as the equation',
    objective: 'Confirm graphical = algebraic.',
    setupLabel: 'Concave, object between C and F.',
    setup: { mirrorType: 'concave', R: 0.6, do: 0.42, ho: 0.25 },
    predictionPrompt: 'Where do rays 1 and 2 cross — at the dᵢ your equation panel predicts?',
    procedure: [
      'Compute dᵢ = f·dₒ/(dₒ − f) from the substituted formula.',
      'Find the crossing point of the solid reflected rays in the diagram.',
      'Move the object slightly; both must move together.',
    ],
    observe: 'Agreement between the drawn crossing and the computed dᵢ, hᵢ.',
    conclusionPrompt: 'Which ray is easiest to construct for a virtual image, and why are dashed extensions needed?',
  },
];

interface Vec {
  x: number;
  y: number;
}
const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** §36.2 — Images formed by spherical mirrors. */
export default function SphericalMirrorLab() {
  const { params, setParam, applyParams } = useLabParams<SphereParams>(
    'image-formation',
    'spherical',
    DEFAULTS,
    RANGES,
  );
  const { R, do: dObj, ho, showRays, showLabels } = params;
  const mirrorType: MirrorType = params.mirrorType === 'convex' ? 'convex' : 'concave';
  const svgRef = useRef<SVGSVGElement>(null);

  const f = useMemo(() => focalLengthFromRadius(R, mirrorType), [R, mirrorType]);
  const img = useMemo(() => calculateSphericalMirrorImage(f, dObj, ho), [f, dObj, ho]);

  // View bounds in physics metres.
  const view = useMemo(() => {
    const CAP = Math.max(3 * R, 2.2); // drawn image-distance cap
    const diAbs = img.imageDistance !== null ? Math.min(Math.abs(img.imageDistance), CAP) : 0;
    const hiAbs = img.imageHeight !== null ? Math.min(Math.abs(img.imageHeight), Math.max(ho * 3, CAP * 0.6)) : 0;
    const apertureTarget = Math.max(ho * 1.6, Math.abs(f) * 0.7);
    const aperture = Math.min(apertureTarget, 0.45 * R);
    const viewLeft = Math.max(dObj, img.imageDistance !== null && img.imageDistance > 0 ? diAbs : 0, Math.abs(2 * f)) * 1.16 + 0.12;
    const viewRight = Math.max(img.imageDistance !== null && img.imageDistance < 0 ? diAbs : 0, Math.abs(f) * 0.9, 0.3) * 1.3;
    const viewUp = Math.max(ho, aperture, hiAbs) * 1.35 + 0.06;
    return { CAP, diAbs, hiAbs, aperture, viewLeft, viewRight, viewUp };
  }, [img, dObj, ho, f, R]);

  const map = useMemo(() => {
    const S = Math.min((VB.w - 80) / (view.viewLeft + view.viewRight), (VB.h - 90) / (2 * view.viewUp));
    const X0 = 45 + view.viewLeft * S;
    const px = (x: number) => X0 + x * S;
    const py = (y: number) => Y0 - y * S;
    return { S, X0, px, py };
  }, [view]);

  const clampedDi = img.imageDistance === null ? null : Math.sign(img.imageDistance) * Math.min(Math.abs(img.imageDistance), view.CAP);
  const imgClamped = clampedDi !== null && img.imageDistance !== null && Math.abs(img.imageDistance) > view.CAP;
  const clampedHi =
    img.imageHeight === null || img.magnification === null
      ? null
      : Math.sign(img.imageHeight) * Math.min(Math.abs(img.imageHeight), Math.max(ho * 3, view.CAP * 0.6));

  const geom = useMemo(() => {
    const T = { x: -dObj, y: ho }; // object tip (physics coords)
    const F = { x: -f, y: 0 };
    const C = { x: -2 * f, y: 0 };
    const tip = { x: clampedDi !== null ? -clampedDi : 0, y: clampedHi ?? 0 };

    // Ray 2 & 3 hit heights (paraxial plane x = 0), skipped near singularities.
    const nearF = Math.abs(dObj - f) < 0.02 * Math.abs(f);
    const nearC = Math.abs(dObj - 2 * f) < 0.02 * Math.abs(f);
    const y2 = nearF ? null : (ho * f) / (f - dObj);
    const y3 = nearC ? null : (ho * 2 * f) / (2 * f - dObj);
    const EXT = view.viewLeft + view.viewRight + 1;

    // Ray 1: parallel → through F (concave) / from F (convex)
    const P1 = { x: 0, y: ho };
    const r1dir = mirrorType === 'concave' ? norm({ x: F.x - P1.x, y: F.y - P1.y }) : norm({ x: P1.x - F.x, y: P1.y - F.y });
    // Ray 2: (through/toward F) → parallel to axis, travelling in −x after reflection
    const r2dir = { x: -1, y: 0 };
    // Ray 3: along the C-line → back on itself
    const P3 = y3 !== null ? { x: 0, y: y3 } : null;
    const r3dir =
      P3 && y3 !== null
        ? mirrorType === 'concave'
          ? norm({ x: C.x - P3.x, y: C.y - y3 })
          : norm({ x: P3.x - C.x, y: y3 - C.y })
        : null;

    // Mirror arc points (paraxial surface, sag from the vertex plane).
    const arc: Vec[] = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const y = -view.aperture + (2 * view.aperture * i) / n;
      const root = Math.sqrt(Math.max(0, R * R - y * y));
      const x = mirrorType === 'concave' ? -R + root : R - root;
      arc.push({ x, y });
    }
    return { T, F, C, tip, P1, P3, y2, y3, r1dir, r2dir, r3dir, EXT, arc, nearF, nearC };
  }, [dObj, ho, f, mirrorType, R, clampedDi, clampedHi, view]);

  const onDragBase = useCallback(
    (p: { x: number; y: number }) => {
      const physX = (p.x - map.X0) / map.S;
      const d = -physX;
      setParam('do', Math.round(Math.max(RANGES.do.min, Math.min(RANGES.do.max, d)) * 100) / 100);
    },
    [map, setParam],
  );
  const onDragTip = useCallback(
    (p: { x: number; y: number }) => {
      const physX = (p.x - map.X0) / map.S;
      const physY = (Y0 - p.y) / map.S;
      setParam('do', Math.round(Math.max(RANGES.do.min, Math.min(RANGES.do.max, -physX)) * 100) / 100);
      setParam('ho', Math.round(Math.max(RANGES.ho.min, Math.min(RANGES.ho.max, physY)) * 100) / 100);
    },
    [map, setParam],
  );

  const line = (a: Vec, dir: Vec, len: number) => {
    const x1 = map.px(a.x);
    const y1 = map.py(a.y);
    const x2 = map.px(a.x + dir.x * len);
    const y2 = map.py(a.y + dir.y * len);
    return { x1, y1, x2, y2 };
  };

  const zone = mirrorType === 'concave' ? concaveObjectZone(dObj, Math.abs(f)) : null;
  const classification = describeSphericalMirrorImage(img);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Mirror type', value: mirrorType },
      { label: 'R (radius of curvature)', value: formatValue(R), unit: 'm' },
      { label: 'f = R/2 (signed)', value: formatValue(f), unit: 'm', tone: mirrorType === 'concave' ? 'green' : 'red' },
      { label: 'Object distance dₒ', value: formatValue(dObj), unit: 'm', tone: 'accent' },
      {
        label: 'Image distance dᵢ',
        value: img.atInfinity ? '→ ∞ (limit)' : `${formatValue(img.imageDistance as number)}${imgClamped ? ' (clamped view)' : ''}`,
        unit: img.atInfinity ? undefined : 'm',
        tone: 'violet',
      },
      { label: 'Magnification m', value: img.atInfinity ? '→ ∞' : formatValue(img.magnification as number), tone: 'amber' },
      { label: 'Image height hᵢ', value: img.atInfinity ? '—' : formatValue(img.imageHeight as number), unit: 'm' },
      { label: 'Nature', value: img.atInfinity ? 'at infinity (limiting case)' : `${img.real ? 'Real' : 'Virtual'}, ${img.upright ? 'upright' : 'inverted'}, ${img.size}` },
      ...(zone ? [{ label: 'Object zone', value: zone } as Measurement] : []),
    ],
    [mirrorType, R, f, dObj, img, imgClamped, zone],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'focal-radius',
        tex: 'f = \\frac{R}{2}',
        caption: mirrorType === 'concave' ? 'Concave ⇒ f > 0 in the real-is-positive convention.' : 'Convex ⇒ f < 0 in the real-is-positive convention.',
        substitutedTex: `f = ${mirrorType === 'concave' ? '+' : '-'}\\frac{${formatValue(R)}}{2} = ${formatValue(f)}\\ \\mathrm{m}`,
      },
      {
        id: 'mirror-eq',
        tex: '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i},\\qquad d_i = \\frac{f\\,d_o}{d_o - f}',
        caption: 'Real-is-positive convention: dₒ > 0 (real object in front); dᵢ > 0 ⇒ real image in front, dᵢ < 0 ⇒ virtual image behind the mirror. Paraxial approximation assumed.',
        variables: [
          { sym: 'f', name: 'signed focal length', unit: `m (now ${formatValue(f)})` },
          { sym: 'd_o', name: 'object distance', unit: `m (now ${formatValue(dObj)})` },
          { sym: 'd_i', name: 'image distance', unit: img.atInfinity ? '→ ∞ (dₒ = f)' : `m (now ${formatValue(img.imageDistance as number)})` },
        ],
        substitutedTex: img.atInfinity
          ? `d_o = f = ${formatValue(f)}\\ \\mathrm{m} \\;\\Rightarrow\\; \\frac{1}{d_i} = 0 \\;\\Rightarrow\\; d_i \\to \\infty`
          : `d_i = \\frac{(${formatValue(f)})(${formatValue(dObj)})}{${formatValue(dObj)} - (${formatValue(f)})} = ${formatValue(img.imageDistance as number, 3)}\\ \\mathrm{m}`,
      },
      {
        id: 'mirror-eq-m',
        tex: 'm = \\frac{h_i}{h_o} = -\\frac{d_i}{d_o}',
        caption: 'm > 0 upright, m < 0 inverted; |m| ≷ 1 magnified/reduced.',
        substitutedTex: img.atInfinity
          ? `m \\to \\infty\\ \\text{(rays parallel — no finite image)}`
          : `m = -\\frac{${formatValue(img.imageDistance as number, 3)}}{${formatValue(dObj)}} = ${formatValue(img.magnification as number, 3)};\\quad h_i = ${formatValue(img.imageHeight as number, 3)}\\ \\mathrm{m}`,
      },
    ],
    [f, dObj, img, mirrorType, R],
  );

  const predictions = useMemo<PredictionScenario<SphereParams>[]>(
    () => [
      {
        id: 'cross-f',
        changeLabel: 'Move object inside F (concave)',
        promptTex: 'A concave mirror ($f > 0$): the object is moved from $d_o > f$ to $d_o < f$. What happens to the image classification?',
        options: [
          { id: 'flip', label: 'Real & inverted → virtual & upright & magnified' },
          { id: 'stay', label: 'It stays real & inverted' },
          { id: 'vanish', label: 'The image disappears completely' },
        ],
        evaluate: (p) => {
          const ff = focalLengthFromRadius(p.R, 'concave');
          const before = calculateSphericalMirrorImage(ff, p.do, p.ho);
          const d2 = Math.max(RANGES.do.min, Math.min(ff * 0.8, 0.8 * ff));
          const after = calculateSphericalMirrorImage(ff, d2, p.ho);
          return {
            correctOptionId: 'flip',
            explanation: `Computed with the mirror equation: before — ${describeSphericalMirrorImage(before)}; after ($d_o = ${formatValue(d2)}\\ \\mathrm{m} < f$) — ${describeSphericalMirrorImage(after)}. Crossing $F$ flips $d_o - f$ sign, so $d_i$ jumps from positive (real) to negative (virtual).`,
            applyTo: (q) => ({ ...q, mirrorType: 'concave', do: d2 }),
          };
        },
      },
      {
        id: 'convex-any',
        changeLabel: 'Switch to convex',
        promptTex: 'The mirror is switched to convex (any $d_o > 0$). What image does a real object get?',
        options: [
          { id: 'vur', label: 'Always virtual, upright, reduced' },
          { id: 'rir', label: 'Always real, inverted, reduced' },
          { id: 'dep', label: 'It depends on whether dₒ is larger than |f|' },
        ],
        evaluate: (p) => {
          const ff = -focalLengthFromRadius(p.R, 'convex');
          const r1 = calculateSphericalMirrorImage(ff, 0.15, p.ho);
          const r2 = calculateSphericalMirrorImage(ff, 3, p.ho);
          return {
            correctOptionId: 'vur',
            explanation: `Computed at both ends of the range: $d_o = 0.15$ m → ${describeSphericalMirrorImage(r1)}; $d_o = 3$ m → ${describeSphericalMirrorImage(r2)}. With $f < 0$, $d_o - f > 0$ always, so $d_i = f d_o/(d_o - f) < 0$ and $0 < m < 1$ for every real object.`,
            applyTo: (q) => ({ ...q, mirrorType: 'convex' }),
          };
        },
      },
    ],
    [],
  );

  const rayColor = '#22d3ee';
  const ray2Color = '#34d399';
  const ray3Color = '#f472b6';
  const extColor = '#8b9dc3';

  return (
    <LabLayout
      scene={
        <div className="panel scene-2d">
          <div className="panel-title">
            Spherical-mirror bench — drag the arrow
            <span style={{ flex: 1 }} />
            <span className="scene-chip">
              {mirrorType} · f = {formatValue(f)} m · {img.atInfinity ? 'image at ∞' : img.real ? 'real image' : 'virtual image'}
            </span>
          </div>
          <svg
            ref={svgRef}
            className="bench-svg"
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            role="img"
            aria-label={`Ray diagram for a ${mirrorType} spherical mirror with focal length ${formatValue(f)} metres and object at ${formatValue(dObj)} metres. ${classification}`}
          >
            {/* principal axis */}
            <line x1={map.px(-view.viewLeft)} y1={map.py(0)} x2={map.px(view.viewRight)} y2={map.py(0)} stroke="#3b4a6b" strokeWidth="1.2" />
            {/* mirror arc */}
            <polyline
              points={geom.arc.map((p) => `${map.px(p.x)},${map.py(p.y)}`).join(' ')}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {geom.arc
              .filter((_, i) => i % 3 === 0)
              .map((p, i) => (
                <line
                  key={i}
                  x1={map.px(p.x)}
                  y1={map.py(p.y)}
                  x2={map.px(p.x + 0.035 * R)}
                  y2={map.py(p.y)}
                  stroke="#5c6b8a"
                  strokeWidth="1.5"
                />
              ))}
            {/* V, F, C markers */}
            {showLabels && (
              <>
                <Marker x={0} label="V" color="#e9edf7" map={map} />
                <Marker x={-f} label="F" color="#fbbf24" map={map} />
                <Marker x={-2 * f} label="C" color="#a78bfa" map={map} />
              </>
            )}
            {/* principal rays (paraxial: reflected at the plane through V) */}
            {showRays && !img.atInfinity && (
              <g>
                {/* ray 1: parallel → through/from F */}
                <line x1={map.px(geom.T.x)} y1={map.py(geom.T.y)} x2={map.px(geom.P1.x)} y2={map.py(geom.P1.y)} stroke={rayColor} strokeWidth="2" />
                <LineSeg a={line(geom.P1, geom.r1dir, geom.EXT)} color={rayColor} w={2} />
                {img.real === false && <LineSeg a={line(geom.P1, { x: -geom.r1dir.x, y: -geom.r1dir.y }, geom.EXT)} color={extColor} w={1.5} dash="5 4" />}
                {/* ray 2: through/toward F → parallel */}
                {geom.y2 !== null && Math.abs(geom.y2) < view.viewUp * 2.2 && (
                  <>
                    <line x1={map.px(geom.T.x)} y1={map.py(geom.T.y)} x2={map.px(0)} y2={map.py(geom.y2)} stroke={ray2Color} strokeWidth="2" />
                    <LineSeg a={line({ x: 0, y: geom.y2 }, geom.r2dir, geom.EXT)} color={ray2Color} w={2} />
                    {img.real === false && (
                      <line x1={map.px(0)} y1={map.py(geom.y2)} x2={map.px(view.viewRight)} y2={map.py(geom.y2)} stroke={extColor} strokeWidth="1.5" strokeDasharray="5 4" />
                    )}
                  </>
                )}
                {/* ray 3: along the C-line → back on itself */}
                {geom.P3 && geom.r3dir && Math.abs(geom.y3 ?? 0) < view.viewUp * 2.2 && (
                  <>
                    <line x1={map.px(geom.T.x)} y1={map.py(geom.T.y)} x2={map.px(0)} y2={map.py(geom.y3 as number)} stroke={ray3Color} strokeWidth="2" />
                    <LineSeg a={line(geom.P3, geom.r3dir, geom.EXT)} color={ray3Color} w={2} />
                    {img.real === false && <LineSeg a={line(geom.P3, { x: -geom.r3dir.x, y: -geom.r3dir.y }, geom.EXT)} color={extColor} w={1.5} dash="5 4" />}
                  </>
                )}
              </g>
            )}
            {showRays && img.atInfinity && (
              <g>
                <line x1={map.px(geom.T.x)} y1={map.py(geom.T.y)} x2={map.px(geom.P1.x)} y2={map.py(geom.P1.y)} stroke={rayColor} strokeWidth="2" />
                <LineSeg a={line(geom.P1, geom.r1dir, geom.EXT)} color={rayColor} w={2} />
                {geom.y2 !== null && Math.abs(geom.y2) < view.viewUp * 2.2 && (
                  <>
                    <line x1={map.px(geom.T.x)} y1={map.py(geom.T.y)} x2={map.px(0)} y2={map.py(geom.y2)} stroke={ray2Color} strokeWidth="2" />
                    <LineSeg a={line({ x: 0, y: geom.y2 }, geom.r2dir, geom.EXT)} color={ray2Color} w={2} />
                  </>
                )}
                <text x={map.px(-view.viewLeft) + 8} y={map.py(view.viewUp) + 16} fill="#fbbf24" fontSize="12">
                  reflected rays are parallel → image at infinity
                </text>
              </g>
            )}
            {/* object arrow */}
            <Arrow x={-dObj} y0={0} y1={ho} map={map} color="#f472b6" solid />
            {/* image arrow */}
            {!img.atInfinity && (
              <Arrow
                x={-(clampedDi as number)}
                y0={0}
                y1={clampedHi as number}
                map={map}
                color={img.real ? '#fbbf24' : '#a78bfa'}
                solid={Boolean(img.real)}
              />
            )}
            {imgClamped && (
              <text x={map.px(-(clampedDi as number)) - 6} y={map.py(0) + 34} fill="#fbbf24" fontSize="11" textAnchor="end">
                image far away (dᵢ = {formatValue(img.imageDistance as number)} m, beyond view) →
              </text>
            )}
            {showLabels && (
              <>
                <text x={map.px(-dObj)} y={map.py(0) + 20} fill="#f472b6" fontSize="12" textAnchor="middle">object</text>
                {!img.atInfinity && (
                  <text x={map.px(-(clampedDi as number))} y={map.py(0) + 20} fill={img.real ? '#fbbf24' : '#a78bfa'} fontSize="12" textAnchor="middle">
                    image ({img.real ? 'real' : 'virtual'})
                  </text>
                )}
              </>
            )}
            {/* drag handles */}
            <DragHandle
              x={map.px(-dObj)}
              y={map.py(0)}
              color="#f472b6"
              label="Drag to move the object along the principal axis"
              valueText={`object ${formatValue(dObj)} metres in front of the mirror`}
              onDrag={onDragBase}
              svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); setParam('do', Math.min(RANGES.do.max, dObj + 0.02)); }
                if (e.key === 'ArrowRight') { e.preventDefault(); setParam('do', Math.max(RANGES.do.min, dObj - 0.02)); }
              }}
            />
            <DragHandle
              x={map.px(-dObj)}
              y={map.py(ho)}
              color="#fbbf24"
              label="Drag the object tip to change its height"
              valueText={`object height ${formatValue(ho)} metres`}
              onDrag={onDragTip}
              svgRef={svgRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); setParam('ho', Math.min(RANGES.ho.max, ho + 0.02)); }
                if (e.key === 'ArrowDown') { e.preventDefault(); setParam('ho', Math.max(RANGES.ho.min, ho - 0.02)); }
              }}
            />
          </svg>
          {img.atInfinity && (
            <Callout kind="warn">
              <b>Limiting case — object at the focal point.</b> dₒ = f makes 1/dᵢ = 1/f − 1/dₒ = 0,
              so |dᵢ| → ∞: the reflected rays leave parallel and the ideal image forms at infinity.
              The app reports this explicitly instead of drawing a fake finite image. Approach F
              from either side to watch |dᵢ| grow without bound and the image flip character as it
              passes through the limit.
            </Callout>
          )}
          <p className="prose" style={{ fontSize: '0.78rem' }}>
            Paraxial drawing convention: principal rays are reflected at the plane through the
            vertex V (standard spherical-mirror approximation), so they intersect exactly at the
            image point predicted by the mirror equation. Real rays are solid; dashed grey lines
            are geometric extensions used to locate virtual images.
          </p>
          <div className="callout ok" style={{ marginTop: 6 }}>
            <b>Classification (computed, not preset):</b> {classification}
          </div>
        </div>
      }
      measurements={<Measurements items={measurements} />}
      controls={
        <>
          <div className="field">
            <span className="field-label">Mirror type</span>
            <div className="segmented" role="group" aria-label="Mirror type">
              <button type="button" aria-pressed={mirrorType === 'concave'} onClick={() => setParam('mirrorType', 'concave')}>Concave (f &gt; 0)</button>
              <button type="button" aria-pressed={mirrorType === 'convex'} onClick={() => setParam('mirrorType', 'convex')}>Convex (f &lt; 0)</button>
            </div>
          </div>
          <ParamSlider label="Radius of curvature" symbol="R" unit="m" value={R} min={0.2} max={1.2} step={0.01} onChange={(v) => setParam('R', v)} tooltip="f = R/2, signed by mirror type" />
          <ParamSlider label="Object distance" symbol="dₒ" unit="m" value={dObj} min={0.12} max={3} step={0.01} onChange={(v) => setParam('do', v)} />
          <ParamSlider label="Object height" symbol="hₒ" unit="m" value={ho} min={0.05} max={0.5} step={0.005} precision={3} onChange={(v) => setParam('ho', v)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={showRays} onChange={(e) => setParam('showRays', e.target.checked)} />
            Show principal rays (1: ∥→F, 2: F→∥, 3: through C)
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={showLabels} onChange={(e) => setParam('showLabels', e.target.checked)} />
            Show V / F / C labels
          </label>
          <PresetBar presets={PRESETS} onApply={(p) => applyParams(p.params)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Image formation by concave and convex spherical mirrors
            (§36.2), computed with the mirror equation and constructed graphically with the three
            principal rays.
          </p>
          <p>
            <b>Sign convention (real-is-positive, documented and used consistently):</b>
          </p>
          <ul>
            <li>Real object in front of the mirror: dₒ &gt; 0.</li>
            <li>Concave mirror: f = +R/2 &gt; 0. Convex mirror: f = −R/2 &lt; 0.</li>
            <li>dᵢ &gt; 0 ⇒ real image in front (projectable); dᵢ &lt; 0 ⇒ virtual image behind.</li>
            <li>m = −dᵢ/dₒ: m &gt; 0 upright, m &lt; 0 inverted; |m| vs 1 gives size.</li>
          </ul>
          <p>
            <b>Approximation.</b> Paraxial rays (close to the axis, small angles) — the condition
            under which a spherical surface images stigmatically and f = R/2 holds. Wide-angle
            spherical aberration is outside this model and not simulated.
          </p>
          <p>
            <b>Singular &amp; limiting cases.</b> At dₒ = f the model reports “image at infinity”
            explicitly (parallel reflected rays) instead of dividing by zero. Very large |dᵢ| is
            clamped for display with a clear “beyond view” note — the numbers shown are always the
            true computed values.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'spherical') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="image-formation" tabId="spherical" params={params} defaultName="Spherical mirror" />}
    />
  );
}

/* ---------- small SVG helpers ---------- */

function LineSeg({
  a,
  color,
  w,
  dash,
}: {
  a: { x1: number; y1: number; x2: number; y2: number };
  color: string;
  w: number;
  dash?: string;
}) {
  return <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={color} strokeWidth={w} strokeDasharray={dash} />;
}

function Marker({
  x,
  label,
  color,
  map,
}: {
  x: number;
  label: string;
  color: string;
  map: { px: (n: number) => number; py: (n: number) => number };
}) {
  return (
    <g>
      <circle cx={map.px(x)} cy={map.py(0)} r="3.4" fill={color} />
      <text x={map.px(x)} y={map.py(0) + 34} fill={color} fontSize="12" textAnchor="middle" fontWeight="600">
        {label}
      </text>
    </g>
  );
}

function Arrow({
  x,
  y0,
  y1,
  map,
  color,
  solid,
}: {
  x: number;
  y0: number;
  y1: number;
  map: { px: (n: number) => number; py: (n: number) => number };
  color: string;
  solid: boolean;
}) {
  const px = map.px(x);
  const py0 = map.py(y0);
  const py1 = map.py(y1);
  const dir = py1 < py0 ? -1 : 1;
  return (
    <g>
      <line x1={px} y1={py0} x2={px} y2={py1} stroke={color} strokeWidth="3.2" strokeDasharray={solid ? undefined : '6 4'} />
      <polygon
        points={`${px},${py1 + dir * 9} ${px - 5},${py1} ${px + 5},${py1}`}
        fill={color}
        opacity={solid ? 1 : 0.85}
      />
    </g>
  );
}
