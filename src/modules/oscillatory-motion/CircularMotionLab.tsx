import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Camera } from 'lucide-react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { Scene3D } from '../../components/sim/Scene3D';
import { LiveValue } from '../../components/sim/LiveValue';
import { SaveBar } from '../../components/sim/SaveBar';
import { ParamSlider } from '../../components/controls/ParamSlider';
import { PlaybackToolbar } from '../../components/controls/PlaybackToolbar';
import { PresetBar } from '../../components/controls/PresetBar';
import type { Preset } from '../../components/controls/PresetBar';
import { Chart2D } from '../../components/charts/Chart2D';
import type { ChartSeriesData } from '../../components/charts/Chart2D';
import { COLORS } from '../../components/theme';
import { GuidedPanel } from '../../components/education/GuidedPanel';
import { PredictionPanel } from '../../components/education/PredictionPanel';
import { PracticePanel } from '../../components/education/PracticePanel';
import { useSimClock } from '../../simulation/useSimClock';
import { useClockEffect } from '../../simulation/useSimClock';
import type { SimClock } from '../../simulation/SimClock';
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { GuidedExperiment, PredictionScenario } from '../../education/types';
import { formatValue } from '../../utils/format';
import { CircularMotionScene } from './scenes/CircularMotionScene';

interface CircParams {
  A: number; // m — circle radius = oscillator amplitude
  omega: number; // rad/s — constant angular speed
  phiDeg: number; // rad at t=0
}

const DEFAULTS: CircParams = { A: 0.35, omega: 2.5, phiDeg: 0 };
const RANGES = {
  A: { min: 0.05, max: 0.5 },
  omega: { min: 0.25, max: 12 },
  phiDeg: { min: -180, max: 180 },
};

const PRESETS: Preset<CircParams>[] = [
  { id: 'base', label: 'Default', params: { ...DEFAULTS } },
  { id: 'slow', label: 'Slow rotation', params: { ...DEFAULTS, omega: 1 } },
  { id: 'fast', label: 'Fast rotation', params: { ...DEFAULTS, omega: 8 } },
  { id: 'phi90', label: 'φ = 90° (starts at sine)', params: { ...DEFAULTS, phiDeg: 90 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'One turn = one oscillation',
    objective: 'Verify that the oscillator period equals the circle period 2π/ω.',
    setupLabel: 'ω = 2.5 rad/s.',
    setup: { A: 0.35, omega: 2.5, phiDeg: 0 },
    predictionPrompt: 'How long does one full revolution take? (Compute 2π/ω before measuring.)',
    procedure: [
      'Compute T = 2π/ω from the readout.',
      'Run the simulation and use the x(t) graph to time one complete oscillation.',
      'Compare the two.',
    ],
    observe: 'Revolution time vs oscillation period.',
    conclusionPrompt: 'Why must they be equal for the projection construction to work?',
  },
  {
    id: 'g2',
    title: 'Shadow of circular motion',
    objective: 'See x(t) = A cos(ωt + φ) emerge geometrically.',
    setupLabel: 'φ = 0.',
    setup: { A: 0.4, omega: 3, phiDeg: 0 },
    predictionPrompt: 'When the particle is at the top of the circle, where is the oscillator mass?',
    procedure: [
      'Pause when the particle reaches the top (θ = 90°).',
      'Read the projection x from the measurements (should be ≈ 0).',
      'Repeat at θ = 0°, 180°, 270°.',
    ],
    observe: 'x = A cos θ at the four cardinal angles.',
    conclusionPrompt: 'Connect each cardinal angle to a feature of the x(t) graph.',
  },
  {
    id: 'g3',
    title: 'Angular speed vs amplitude',
    objective: 'Distinguish what ω and A control.',
    setupLabel: 'Defaults.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Which of ω or A changes the oscillation frequency? Which changes its extent?',
    procedure: [
      'Double A; observe period and range of x.',
      'Restore A and double ω; observe again.',
    ],
    observe: 'Period and amplitude after each change.',
    conclusionPrompt: 'Summarize: frequency is set by ___, amplitude by ___.',
  },
];

/** §15.4 — Comparing SHM with uniform circular motion. */
export default function CircularMotionLab() {
  const { params, setParam, applyParams } = useLabParams<CircParams>(
    'oscillatory-motion',
    'circular',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { A, omega, phiDeg } = params;
  const phase = (phiDeg * Math.PI) / 180;

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const T = (2 * Math.PI) / omega;

  const getState = useCallback(
    (t: number) => {
      const thetaRaw = omega * t + phase;
      const theta = ((thetaRaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const x = A * Math.cos(thetaRaw);
      const v = -A * omega * Math.sin(thetaRaw);
      return { theta, x, v };
    },
    [A, omega, phase],
  );

  const sceneState = useCallback(
    (t: number) => ({ theta: getState(t).theta, x: getState(t).x, amplitude: A }),
    [getState, A],
  );

  const series = useCallback((): ChartSeriesData[] => {
    const N = 500;
    const tEnd = 3 * T;
    const xd = new Float64Array(2 * N);
    const cd = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      const s = getState(t);
      xd[2 * i] = cd[2 * i] = t;
      xd[2 * i + 1] = s.x;
      cd[2 * i + 1] = A * Math.cos(s.theta); // identical by construction — proves projection
    }
    return [
      { name: 'oscillator x(t)', color: COLORS.cyan, data: xd },
      { name: 'circle projection A·cos θ(t)', color: COLORS.amber, dash: [2, 3], data: cd },
    ];
  }, [getState, T, A]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Angular speed ω', value: formatValue(omega), unit: 'rad/s' },
      { label: 'Circle period 2π/ω', value: formatValue(T), unit: 's', tone: 'accent' },
      { label: 'Radius = amplitude A', value: formatValue(A), unit: 'm' },
      { label: 'v_max = Aω', value: formatValue(A * omega), unit: 'm/s' },
      { label: 'Phase θ', unit: 'rad', live: (t) => formatValue(getState(t).theta), tone: 'violet' },
      { label: 'θ (degrees)', unit: '°', live: (t) => formatValue((getState(t).theta * 180) / Math.PI, 1) },
      { label: 'Projection x = A cos θ', unit: 'm', live: (t) => formatValue(getState(t).x), tone: 'accent' },
      { label: 'Oscillator velocity', unit: 'm/s', live: (t) => formatValue(getState(t).v) },
    ],
    [omega, T, A, getState],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'circ-proj',
        tex: '\\text{particle: } (A\\cos\\theta,\\, A\\sin\\theta),\\quad \\theta = \\omega t + \\varphi',
        caption: 'Uniform circular motion of radius A at constant angular speed ω.',
      },
      {
        tex: 'x(t) = A\\cos(\\omega t + \\varphi)',
        caption: 'The projection of the particle onto the horizontal axis is exactly SHM with the same ω and φ.',
        substitutedTex: `x(t) = ${formatValue(A)}\\cos(${formatValue(omega, 3)}\\,t ${phase >= 0 ? '+' : '−'} ${formatValue(Math.abs(phase))})`,
      },
      {
        tex: 'v_x(t) = -A\\omega\\sin(\\omega t + \\varphi)',
        caption: 'Horizontal component of the tangential velocity Aω.',
        substitutedTex: `v_{max} = A\\omega = ${formatValue(A * omega)}\\ \\mathrm{m/s}`,
      },
    ],
    [A, omega, phase],
  );

  const predictions = useMemo<PredictionScenario<CircParams>[]>(
    () => [
      {
        id: 'omega2',
        changeLabel: 'Double ω',
        promptTex: 'The angular speed is doubled. What happens to the **period of the oscillator**?',
        options: [
          { id: 'half', label: 'It halves' },
          { id: 'double', label: 'It doubles' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const T1 = (2 * Math.PI) / p.omega;
          const w2 = Math.min(RANGES.omega.max, p.omega * 2);
          const T2 = (2 * Math.PI) / w2;
          return {
            correctOptionId: 'half',
            explanation: `Computed: $T_1 = 2\\pi/${formatValue(p.omega)} = ${formatValue(T1, 3)}\\ \\mathrm{s}$; $T_2 = ${formatValue(T2, 3)}\\ \\mathrm{s}$ — exactly half. The projection completes one oscillation per revolution.`,
            applyTo: (q) => ({ ...q, omega: w2 }),
          };
        },
      },
      {
        id: 'A2',
        changeLabel: 'Double radius A',
        promptTex: 'The circle radius (oscillator amplitude) is doubled. What happens to $v_{max} = A\\omega$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'same', label: 'It stays the same' },
          { id: 'x4', label: 'It quadruples' },
        ],
        evaluate: (p) => {
          const v1 = p.A * p.omega;
          const A2 = Math.min(RANGES.A.max, p.A * 2);
          const v2 = A2 * p.omega;
          return {
            correctOptionId: 'x2',
            explanation: `Computed: $v_{max}$ goes from ${formatValue(v1)} to ${formatValue(v2)}\\ \\mathrm{m/s}$ — proportional to $A$ at fixed $\\omega$. The period is untouched.`,
            applyTo: (q) => ({ ...q, A: A2 }),
          };
        },
      },
    ],
    [],
  );

  const marker = useMemo(() => ({ x: () => handle.clock.getTime(), label: 'now' }), [handle.clock]);

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0.4, 0.6, 5.2], fov: 45 }}
          ariaLabel="3D scene: a particle moves uniformly around a reference circle while its horizontal projection drives a spring oscillator below. Both readouts are tabulated in the measurements panel."
          fallback={
            <div style={{ width: '100%', maxWidth: 420 }}>
              <p className="prose">
                2D equivalent: the oscillator position below is x = A·cos θ, the horizontal
                projection of uniform circular motion — the same model drives the x(t) chart and
                the measurements.
              </p>
              <ProjectionMiniSvg getState={getState} clock={handle.clock} A={A} />
            </div>
          }
        >
          <CircularMotionScene clock={handle.clock} getState={sceneState} controlsRef={controlsRef} />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 * T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                θ = <LiveValue clock={handle.clock} compute={(t) => `${formatValue((getState(t).theta * 180) / Math.PI, 0)}°`} />
              </span>
              <span className="scene-chip">
                x = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(getState(t).x)} m`} />
              </span>
              <button type="button" className="btn ghost sm" onClick={() => controlsRef.current?.reset()}>
                <Camera size={13} /> Reset view
              </button>
            </span>
          </div>
        </>
      }
      measurements={<Measurements items={measurements} clock={handle.clock} />}
      charts={
        <div className="charts-row">
          <Chart2D
            title="Oscillator x(t) vs the circle projection"
            xLabel="t (s)"
            yLabel="x (m)"
            ySymmetric
            series={series}
            clock={handle.clock}
            redrawKey={params}
            xDomain={[0, 3 * T]}
            marker={marker}
            onPickX={(x) => handle.setTime(Math.max(0, Math.min(3 * T, x)))}
            ariaSummary="Two identical overlaid curves: the oscillator displacement and the horizontal projection of the circling particle."
          />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Circle radius = amplitude" symbol="A" unit="m" value={A} min={0.05} max={0.5} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
          <ParamSlider label="Angular speed" symbol="ω" unit="rad/s" value={omega} min={0.25} max={12} step={0.05} onChange={(v) => setParam('omega', v)} tooltip="Constant angular speed of the reference particle = angular frequency of the oscillator" />
          <ParamSlider label="Initial phase" symbol="φ" unit="°" value={phiDeg} min={-180} max={180} step={1} precision={0} onChange={(v) => setParam('phiDeg', v)} />
          <p className="prose" style={{ fontSize: '0.78rem' }}>
            Both views share one clock and one θ(t) = ωt + φ. The amber dashed curve in the graph is
            the circle’s projection, the cyan curve the oscillator — they coincide by construction,
            which is the point of §15.4.
          </p>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Every SHM is the “shadow” of a uniform circular motion:
            a particle on a circle of radius A at angular speed ω has horizontal coordinate
            A cos(ωt + φ) — exactly the SHM solution.
          </p>
          <p>
            <b>Assumptions.</b> Constant ω (uniform rotation); the oscillator is ideal, with
            ω playing the role of √(k/m). The linkage is exact in the model: same ω, same φ, same
            clock for the circle, the spring, the graph and the readouts.
          </p>
          <p>
            <b>Observe.</b> x is maximal when the particle crosses the horizontal axis; x = 0 when
            the particle is at the top or bottom; the oscillator is fastest where the circle
            tangent is purely horizontal.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      prediction={
        <PredictionPanel
          scenarios={predictions}
          getParams={() => ({ ...params })}
          applyParams={(p) => { applyParams(p); handle.reset(); }}
        />
      }
      investigations={<GuidedPanel experiments={GUIDED} onLoad={(s) => { applyParams(s); handle.reset(); }} />}
      practice={
        <PracticePanel
          moduleId="oscillatory-motion"
          generate={() => generateQuestion('oscillatory-motion')}
          onLoadToSim={() => { /* circular tab has no generated-question target; no-op by design */ }}
        />
      }
      actions={<SaveBar moduleId="oscillatory-motion" tabId="circular" params={params} defaultName="Circular-motion projection" />}
    />
  );
}

/** 2D fallback: circle + projection, updated from the same clock. */
function ProjectionMiniSvg({
  getState,
  clock,
  A,
}: {
  getState: (t: number) => { theta: number; x: number };
  clock: SimClock;
  A: number;
}) {
  const dotRef = useRef<SVGCircleElement>(null);
  const massRef = useRef<SVGRectElement>(null);
  const dropRef = useRef<SVGLineElement>(null);
  const stateRef = useRef(getState);
  useEffect(() => {
    stateRef.current = getState;
  });
  const R = 70;
  const cy = 90;
  const oscY = 185;
  useClockEffect(clock, (t) => {
    const s = stateRef.current(t);
    const px = 110 + R * Math.cos(s.theta);
    const py = cy - R * Math.sin(s.theta);
    const ox = 110 + (R / Math.max(A, 1e-9)) * s.x;
    dotRef.current?.setAttribute('cx', String(px));
    dotRef.current?.setAttribute('cy', String(py));
    massRef.current?.setAttribute('x', String(ox - 9));
    dropRef.current?.setAttribute('x1', String(px));
    dropRef.current?.setAttribute('x2', String(ox));
  });
  return (
    <svg viewBox="0 0 220 210" style={{ width: '100%', maxWidth: 280 }} role="img" aria-label="2D circle with rotating particle and its horizontal projection driving a sliding mass.">
      <circle cx="110" cy={cy} r={R} fill="none" stroke="#5b8cff" strokeWidth="1.6" />
      <line x1={110 - R} y1={cy} x2={110 + R} y2={cy} stroke="#5c6b8a" strokeDasharray="4 3" />
      <line ref={dropRef} x1="110" y1={cy} x2="110" y2={oscY} stroke="#22d3ee" strokeDasharray="3 3" />
      <circle ref={dotRef} cx={110 + R} cy={cy} r="5.5" fill="#fbbf24" />
      <line x1="30" y1={oscY} x2="190" y2={oscY} stroke="#5c6b8a" />
      <rect ref={massRef} x="101" y={oscY - 9} width="18" height="18" rx="3" fill="#4f7dff" />
    </svg>
  );
}
