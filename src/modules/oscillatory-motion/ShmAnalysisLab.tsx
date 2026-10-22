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
import { PredictionPanel } from '../../components/education/PredictionPanel';
import { GuidedPanel } from '../../components/education/GuidedPanel';
import { PracticePanel } from '../../components/education/PracticePanel';
import { useSimClock } from '../../simulation/useSimClock';
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { PredictionScenario, GuidedExperiment } from '../../education/types';
import {
  calculateShmState,
  shmAngularFrequency,
  shmFrequency,
  shmPeriod,
  shmPhaseMarker,
} from '../../physics/shm/shm';
import type { ShmSolution } from '../../physics/shm/shm';
import { formatValue } from '../../utils/format';
import { SpringMassScene } from './scenes/SpringMassScene';
import { SpringFallbackSvg } from './scenes/SpringFallbackSvg';
import { springForce } from '../../physics/shm/shm';

interface ShmParams {
  m: number;
  k: number;
  A: number; // m
  phiDeg: number;
  showVectors: boolean;
}

const DEFAULTS: ShmParams = { m: 0.5, k: 20, A: 0.25, phiDeg: 0, showVectors: true };
const RANGES = {
  m: { min: 0.1, max: 5 },
  k: { min: 1, max: 200 },
  A: { min: 0.02, max: 0.5 },
  phiDeg: { min: -180, max: 180 },
};

const PRESETS: Preset<ShmParams>[] = [
  { id: 'cos', label: 'Starts at +A (φ = 0)', params: { ...DEFAULTS, phiDeg: 0 } },
  { id: 'sin', label: 'Starts at equilibrium (φ = −90°)', params: { ...DEFAULTS, phiDeg: -90 } },
  { id: 'inverted', label: 'Starts at −A (φ = 180°)', params: { ...DEFAULTS, phiDeg: 180 } },
  { id: 'fast', label: 'Fast oscillator (k = 120)', params: { ...DEFAULTS, k: 120, m: 0.3 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'The quarter-period lag between x, v and a',
    objective: 'Verify that velocity leads displacement by 90° (a quarter period).',
    setupLabel: 'A = 0.25 m, φ = 0, default m and k.',
    setup: { A: 0.25, phiDeg: 0, m: 0.5, k: 20 },
    predictionPrompt: 'When x(t) is at its maximum, is v at a maximum, a minimum, or zero?',
    procedure: [
      'Observe the three synchronized graphs (x, v, a) with the shared time marker.',
      'Click on the x-graph at t = 0 — all three markers jump there. Read v and a.',
      'Seek to t = T/4 (read T from measurements). Compare the three values again.',
      'Repeat for t = T/2 and t = 3T/4.',
    ],
    observe: 'Value triples (x, v, a) at the four quarter-period instants.',
    conclusionPrompt: 'Explain the quarter-period phase shift using v = dx/dt and a = dv/dt.',
  },
  {
    id: 'g2',
    title: 'a = −ω²x at every instant',
    objective: 'Confirm the defining SHM relation numerically.',
    setupLabel: 'Any running configuration.',
    setup: { A: 0.3, phiDeg: 30 },
    predictionPrompt: 'What sign does a have when x is positive?',
    procedure: [
      'Step through several times with single-step.',
      'At each stop compute −ω²·x from the readouts (ω is shown).',
      'Compare with the displayed acceleration a.',
    ],
    observe: 'Agreement within display precision at every sampled instant.',
    conclusionPrompt: 'Why does this relation guarantee sinusoidal motion?',
  },
  {
    id: 'g3',
    title: 'Phase constant φ shifts the whole story in time',
    objective: 'Connect φ to a time shift Δt = −φ/ω.',
    setupLabel: 'φ = 0 baseline.',
    setup: { phiDeg: 0, A: 0.25 },
    predictionPrompt: 'Increasing φ to +90° is equivalent to shifting the clock forward or backward by T/4?',
    procedure: [
      'Note where the first peak of x(t) occurs with φ = 0.',
      'Set φ = +90° and locate the first peak again.',
      'Compute Δt = −φ/ω and check it matches the observed shift.',
    ],
    observe: 'Peak position before/after and the computed Δt.',
    conclusionPrompt: 'State the relation between phase and time shift.',
  },
];

/** §15.2 — Analysis model: particle in simple harmonic motion. */
export default function ShmAnalysisLab() {
  const { params, setParam, applyParams } = useLabParams<ShmParams>(
    'oscillatory-motion',
    'shm',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { m, k, A, phiDeg } = params;

  const solution = useMemo<ShmSolution>(() => {
    const omega = shmAngularFrequency({ k, m });
    return { omega, amplitude: A, phase: (phiDeg * Math.PI) / 180 };
  }, [m, k, A, phiDeg]);

  const T = useMemo(() => shmPeriod({ k, m }), [k, m]);
  const f = useMemo(() => shmFrequency({ k, m }), [k, m]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const getState = useCallback(
    (t: number) => {
      const s = calculateShmState(solution, t);
      return { x: s.x, v: s.v, a: s.a, F: springForce(k, s.x), theta: s.theta };
    },
    [solution, k],
  );

  const makeSeries = useCallback(
    (pick: (s: ReturnType<typeof calculateShmState>) => number, name: string, color: string): ChartSeriesData => {
      const N = 540;
      const tEnd = 3 * T;
      const data = new Float64Array(2 * N);
      for (let i = 0; i < N; i++) {
        const t = (tEnd * i) / (N - 1);
        data[2 * i] = t;
        data[2 * i + 1] = pick(calculateShmState(solution, t));
      }
      return { name, color, data };
    },
    [solution, T],
  );

  const charts = useCallback(
    () => [makeSeries((s) => s.x, 'x(t) — displacement', COLORS.cyan)],
    [makeSeries],
  );
  const chartV = useCallback(
    () => [makeSeries((s) => s.v, 'v(t) — velocity', COLORS.violet)],
    [makeSeries],
  );
  const chartA = useCallback(
    () => [makeSeries((s) => s.a, 'a(t) — acceleration', COLORS.amber)],
    [makeSeries],
  );

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Period T', value: formatValue(T), unit: 's', tone: 'accent' },
      { label: 'Frequency f', value: formatValue(f), unit: 'Hz' },
      { label: 'ω', value: formatValue(solution.omega), unit: 'rad/s' },
      { label: 'v_max = Aω', value: formatValue(A * solution.omega), unit: 'm/s' },
      { label: 'a_max = Aω²', value: formatValue(A * solution.omega ** 2), unit: 'm/s²' },
      {
        label: 'Phase θ = ωt + φ',
        unit: 'rad',
        live: (t) => formatValue(calculateShmState(solution, t).theta),
        tone: 'violet',
      },
      { label: 'x', unit: 'm', live: (t) => formatValue(getState(t).x), tone: 'accent' },
      { label: 'v', unit: 'm/s', live: (t) => formatValue(getState(t).v) },
      { label: 'a', unit: 'm/s²', live: (t) => formatValue(getState(t).a), tone: 'amber' },
      {
        label: 'Phase marker',
        live: (t) => shmPhaseMarker(calculateShmState(solution, t)).label,
      },
    ],
    [T, f, solution, A, getState],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'shm-x',
        tex: 'x(t) = A\\cos(\\omega t + \\varphi)',
        variables: [
          { sym: 'A', name: 'amplitude', unit: `m (now ${formatValue(A)})` },
          { sym: '\\varphi', name: 'phase constant', unit: `rad (now ${formatValue(solution.phase)})` },
        ],
        substitutedTex: `x(t) = ${formatValue(A)}\\cos(${formatValue(solution.omega, 3)}\\,t ${solution.phase >= 0 ? '+' : '−'} ${formatValue(Math.abs(solution.phase))})`,
      },
      {
        tex: 'v(t) = \\frac{dx}{dt} = -A\\omega\\sin(\\omega t + \\varphi)',
        caption: 'The derivative of x(t) — leads x by 90°.',
        substitutedTex: `v_{max} = A\\omega = ${formatValue(A * solution.omega)}\\ \\mathrm{m/s}`,
      },
      {
        tex: 'a(t) = \\frac{dv}{dt} = -\\omega^2 x(t)',
        caption: 'The defining relation of SHM: acceleration ∝ −displacement.',
        substitutedTex: `a_{max} = A\\omega^2 = ${formatValue(A * solution.omega ** 2)}\\ \\mathrm{m/s^2}`,
      },
    ],
    [A, solution],
  );

  const predictions = useMemo<PredictionScenario<ShmParams>[]>(
    () => [
      {
        id: 'phi-shift',
        changeLabel: 'φ: 0 → +90°',
        promptTex:
          'The phase constant increases from $0$ to $+90^\\circ$. What happens to the displacement at $t = 0$?',
        options: [
          { id: 'zero', label: 'x(0) becomes 0 (mass starts at equilibrium, moving in −x)' },
          { id: 'maxA', label: 'x(0) stays at +A' },
          { id: 'minA', label: 'x(0) becomes −A' },
        ],
        evaluate: (p) => {
          const x0 = p.A * Math.cos((p.phiDeg * Math.PI) / 180);
          const phi2 = Math.min(RANGES.phiDeg.max, p.phiDeg + 90);
          const x2 = p.A * Math.cos((phi2 * Math.PI) / 180);
          const correct = Math.abs(x2) < 1e-9 * Math.max(1, p.A) ? 'zero' : x2 > 0 ? 'maxA' : 'minA';
          return {
            correctOptionId: Math.abs(x2) < 0.01 * p.A ? 'zero' : correct,
            explanation: `Model check: $x(0) = A\\cos\\varphi$: before $x(0) = ${formatValue(x0)}\\ \\mathrm{m}$; after $\\varphi = ${phi2}^\\circ$, $x(0) = ${formatValue(x2)}\\ \\mathrm{m}$. Adding $90^\\circ$ to $\\varphi$ is a **time shift** $\\Delta t = -\\varphi/\\omega$ of one quarter period.`,
            applyTo: (q) => ({ ...q, phiDeg: phi2 }),
          };
        },
      },
      {
        id: 'omega-change',
        changeLabel: 'Quadruple k',
        promptTex: 'The spring constant is quadrupled. What happens to $v_{max} = A\\omega$ (with $A$ fixed)?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const w1 = shmAngularFrequency({ k: p.k, m: p.m });
          const k2 = Math.min(RANGES.k.max, p.k * 4);
          const w2 = shmAngularFrequency({ k: k2, m: p.m });
          return {
            correctOptionId: 'x2',
            explanation: `Computed: $\\omega_1 = ${formatValue(w1, 3)}$, $\\omega_2 = ${formatValue(w2, 3)}\\ \\mathrm{rad/s}$; $v_{max}$ goes from ${formatValue(p.A * w1)} to ${formatValue(p.A * w2)}\\ \\mathrm{m/s}$ — exactly ×2 because $\\omega \\propto \\sqrt{k}$.`,
            applyTo: (q) => ({ ...q, k: k2 }),
          };
        },
      },
    ],
    [],
  );

  const marker = useMemo(
    () => ({ x: () => handle.clock.getTime(), label: 'now', color: '#fbbf24' }),
    [handle.clock],
  );
  const seek = useCallback((x: number) => handle.setTime(Math.max(0, Math.min(3 * T, x))), [handle, T]);

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [1.9, 0.6, 3.4], fov: 45 }}
          ariaLabel="3D oscillator synchronized with the three graphs below."
          fallback={<SpringFallbackSvg getState={getState} clock={handle.clock} />}
        >
          <SpringMassScene
            clock={handle.clock}
            getState={getState}
            showVectors={params.showVectors}
            showForce={false}
            showRuler={true}
            controlsRef={controlsRef}
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 * T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                θ = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(getState(t).theta)} rad`} />
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
          <Chart2D title="Displacement x(t)" xLabel="t (s)" yLabel="x (m)" ySymmetric series={charts} clock={handle.clock} redrawKey={params} xDomain={[0, 3 * T]} marker={marker} onPickX={seek} ariaSummary="Sinusoidal displacement versus time." />
          <Chart2D title="Velocity v(t)" xLabel="t (s)" yLabel="v (m/s)" ySymmetric series={chartV} clock={handle.clock} redrawKey={params} xDomain={[0, 3 * T]} marker={marker} onPickX={seek} ariaSummary="Sinusoidal velocity versus time, 90 degrees ahead of displacement." />
          <Chart2D title="Acceleration a(t)" xLabel="t (s)" yLabel="a (m/s²)" ySymmetric series={chartA} clock={handle.clock} redrawKey={params} xDomain={[0, 3 * T]} marker={marker} onPickX={seek} ariaSummary="Acceleration versus time, opposite in sign to displacement." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Mass" symbol="m" unit="kg" value={m} min={0.1} max={5} step={0.05} onChange={(v) => setParam('m', v)} />
          <ParamSlider label="Spring constant" symbol="k" unit="N/m" value={k} min={1} max={200} step={1} precision={1} onChange={(v) => setParam('k', v)} />
          <ParamSlider label="Amplitude" symbol="A" unit="m" value={A} min={0.02} max={0.5} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
          <ParamSlider label="Phase constant" symbol="φ" unit="°" value={phiDeg} min={-180} max={180} step={1} precision={0} onChange={(v) => setParam('phiDeg', v)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={params.showVectors} onChange={(e) => setParam('showVectors', e.target.checked)} />
            Show v and a arrows
          </label>
          <p className="prose" style={{ fontSize: '0.78rem' }}>
            In this analysis mode A and φ are set directly (x(0) = A cos φ, v(0) = −Aω sin φ).
            Use §15.1 to start from measured initial conditions x₀, v₀ instead.
            <br />
            <b>Tip:</b> click anywhere on a graph to seek the simulation to that time.
          </p>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> The analysis model of §15.2: any particle whose acceleration
            obeys a = −ω²x executes SHM x(t) = A cos(ωt + φ). The three graphs and the 3D oscillator
            share the same solution object and the same clock.
          </p>
          <p>
            <b>Key relations.</b> v is the time derivative of x (90° ahead); a is the derivative of v
            (180° from x, i.e. always opposite to displacement). At turning points v = 0 and |a| is
            maximal; at equilibrium a = 0 and |v| is maximal. The “phase marker” readout names these
            special instants.
          </p>
          <p>
            <b>Assumptions.</b> Ideal (undamped, linear) restoring force; constant ω; exact analytic
            solution evaluated at the clock time — no accumulated integration error.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'shm' || target === 'spring') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="oscillatory-motion" tabId="shm" params={params} defaultName="SHM analysis" />}
    />
  );
}
