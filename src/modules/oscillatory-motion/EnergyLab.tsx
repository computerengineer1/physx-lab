import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useClockEffect } from '../../simulation/useSimClock';
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { PredictionScenario, GuidedExperiment } from '../../education/types';
import type { SimClock } from '../../simulation/SimClock';
import { shmAngularFrequency, shmPeriod } from '../../physics/shm/shm';
import { calculateOscillatorEnergy, energyAtPosition, totalOscillatorEnergy } from '../../physics/shm/energy';
import { formatValue } from '../../utils/format';
import { SpringMassScene } from './scenes/SpringMassScene';
import { SpringFallbackSvg } from './scenes/SpringFallbackSvg';
import { springForce } from '../../physics/shm/shm';

interface EnergyParams {
  m: number;
  k: number;
  A: number;
  phiDeg: number;
}

const DEFAULTS: EnergyParams = { m: 0.5, k: 20, A: 0.25, phiDeg: 0 };
const RANGES = {
  m: { min: 0.1, max: 5 },
  k: { min: 1, max: 200 },
  A: { min: 0.02, max: 0.5 },
  phiDeg: { min: -180, max: 180 },
};

const PRESETS: Preset<EnergyParams>[] = [
  { id: 'base', label: 'Default', params: { ...DEFAULTS } },
  { id: 'double-A', label: 'Double amplitude', params: { ...DEFAULTS, A: 0.5 } },
  { id: 'stiff', label: 'Stiff & light', params: { ...DEFAULTS, k: 120, m: 0.2 } },
  { id: 'soft-heavy', label: 'Soft & heavy', params: { ...DEFAULTS, k: 4, m: 3 } },
];

/** Live stacked K/U bar — updates imperatively from the clock (no re-render). */
function EnergyBars({ clock, energyAt }: { clock: SimClock; energyAt: (t: number) => { K: number; U: number; E: number } }) {
  const kBar = useRef<HTMLDivElement>(null);
  const uBar = useRef<HTMLDivElement>(null);
  const kTxt = useRef<HTMLSpanElement>(null);
  const uTxt = useRef<HTMLSpanElement>(null);
  useClockEffect(clock, (t) => {
    const { K, U, E } = energyAt(t);
    const safeE = E > 0 ? E : 1;
    if (kBar.current) kBar.current.style.width = `${(K / safeE) * 100}%`;
    if (uBar.current) uBar.current.style.width = `${(U / safeE) * 100}%`;
    if (kTxt.current) kTxt.current.textContent = `K = ${formatValue(K)} J`;
    if (uTxt.current) uTxt.current.textContent = `U = ${formatValue(U)} J`;
  });
  return (
    <div>
      <div
        style={{
          display: 'flex',
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--bg-2)',
        }}
        role="img"
        aria-label="Bar showing the live split between kinetic and potential energy"
      >
        <div ref={kBar} style={{ background: COLORS.violet, width: '50%', transition: 'none' }} />
        <div ref={uBar} style={{ background: COLORS.cyan, width: '50%', transition: 'none' }} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 5, fontSize: '0.75rem' }}>
        <span style={{ color: COLORS.violet }}>
          <span ref={kTxt}>K</span> (kinetic)
        </span>
        <span style={{ color: COLORS.cyan }}>
          <span ref={uTxt}>U</span> (spring potential)
        </span>
      </div>
    </div>
  );
}

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Verify conservation of total energy',
    objective: 'Confirm E = K + U stays constant in the ideal model.',
    setupLabel: 'Default setup.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Over one full period, does E drift, oscillate, or stay constant?',
    procedure: [
      'Play for several periods and watch the flat green E(t) line.',
      'Single-step through a period; read K and U at each stop and add them.',
      'Compare the sum with ½kA² from the measurements.',
    ],
    observe: 'K + U at sampled instants vs the constant E readout.',
    conclusionPrompt: 'Where is energy purely kinetic? Purely potential? What is E in terms of k and A?',
  },
  {
    id: 'g2',
    title: 'What happens to total energy if the amplitude doubles?',
    objective: 'Derive the E ∝ A² scaling from measurements, not memory.',
    setupLabel: 'A = 0.25 m baseline.',
    setup: { A: 0.25, k: 20, m: 0.5, phiDeg: 0 },
    predictionPrompt: 'Doubling A changes E by what factor: 2, 4, or √2?',
    procedure: [
      'Record E for A = 0.25 m.',
      'Set A = 0.50 m and record E again.',
      'Compute the ratio and compare with ½kA² for both amplitudes.',
    ],
    observe: 'The ratio E(2A)/E(A).',
    conclusionPrompt: 'Explain the result from E = ½kA². Does the period change too?',
  },
  {
    id: 'g3',
    title: 'Where is K = U?',
    objective: 'Locate the positions where energy is split 50/50.',
    setupLabel: 'Default setup.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'At what fraction of the amplitude is K exactly half of E?',
    procedure: [
      'Watch the K/U bar while stepping through the motion.',
      'Note the displacement readout when the bar shows an even split.',
      'Check against x = A/√2 computed from the model.',
    ],
    observe: 'x at 50/50 split vs A/√2.',
    conclusionPrompt: 'Why does the 50/50 point sit at A/√2? (Use U = ½kx² = E/2.)',
  },
];

/** §15.3 — Energy of the simple harmonic oscillator. */
export default function EnergyLab() {
  const { params, setParam, applyParams } = useLabParams<EnergyParams>(
    'oscillatory-motion',
    'energy',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { m, k, A, phiDeg } = params;

  const omega = useMemo(() => shmAngularFrequency({ k, m }), [k, m]);
  const T = useMemo(() => shmPeriod({ k, m }), [k, m]);
  const phase = (phiDeg * Math.PI) / 180;
  const E = useMemo(() => totalOscillatorEnergy(k, A), [k, A]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const energyAt = useCallback(
    (t: number) => {
      const e = calculateOscillatorEnergy({ k, m }, { amplitude: A, phase }, t);
      return { K: e.kinetic, U: e.potential, E: e.total, x: e.x, v: e.v };
    },
    [k, m, A, phase],
  );

  const getState = useCallback(
    (t: number) => {
      const e = energyAt(t);
      return { x: e.x, v: e.v, a: -omega * omega * e.x, F: springForce(k, e.x) };
    },
    [energyAt, omega, k],
  );

  const timeSeries = useCallback((): ChartSeriesData[] => {
    const N = 480;
    const tEnd = 2 * T;
    const kd = new Float64Array(2 * N);
    const ud = new Float64Array(2 * N);
    const ed = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      const e = energyAt(t);
      kd[2 * i] = ud[2 * i] = ed[2 * i] = t;
      kd[2 * i + 1] = e.K;
      ud[2 * i + 1] = e.U;
      ed[2 * i + 1] = e.E;
    }
    return [
      { name: 'K(t) = ½mv²', color: COLORS.violet, data: kd },
      { name: 'U(t) = ½kx²', color: COLORS.cyan, data: ud },
      { name: 'E = K + U (constant)', color: COLORS.green, data: ed },
    ];
  }, [energyAt, T]);

  const positionSeries = useCallback((): ChartSeriesData[] => {
    const N = 300;
    const ud = new Float64Array(2 * N);
    const kd = new Float64Array(2 * N);
    const ed = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = -A + (2 * A * i) / (N - 1);
      const e = energyAtPosition(k, A, x);
      ud[2 * i] = kd[2 * i] = ed[2 * i] = x;
      ud[2 * i + 1] = e.potential;
      kd[2 * i + 1] = e.kinetic;
      ed[2 * i + 1] = e.total;
    }
    return [
      { name: 'U(x) = ½kx²', color: COLORS.cyan, data: ud },
      { name: 'K(x) = E − U', color: COLORS.violet, data: kd, dash: [7, 4] },
      { name: 'E = ½kA²', color: COLORS.green, data: ed },
    ];
  }, [k, A]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Total energy E', value: formatValue(E), unit: 'J', tone: 'green' },
      { label: 'U_max (= E at turns)', value: formatValue(E), unit: 'J' },
      { label: 'K_max (= E at x=0)', value: formatValue(E), unit: 'J' },
      { label: 'v_max = Aω', value: formatValue(A * omega), unit: 'm/s' },
      { label: 'K', unit: 'J', live: (t) => formatValue(energyAt(t).K), tone: 'violet' },
      { label: 'U', unit: 'J', live: (t) => formatValue(energyAt(t).U), tone: 'accent' },
      { label: 'K + U', unit: 'J', live: (t) => formatValue(energyAt(t).K + energyAt(t).U), tone: 'green' },
      { label: 'K / E fraction', unit: '%', live: (t) => formatValue(100 * energyAt(t).K / Math.max(E, 1e-12), 1) },
    ],
    [E, A, omega, energyAt],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'shm-energy',
        tex: 'K = \\tfrac12 m v^2,\\quad U_s = \\tfrac12 k x^2,\\quad E = \\tfrac12 kA^2',
        variables: [
          { sym: 'E', name: 'total mechanical energy', unit: `J (now ${formatValue(E)})` },
        ],
        substitutedTex: `E = \\tfrac12 (${formatValue(k)})(${formatValue(A)})^2 = ${formatValue(E, 4)}\\ \\mathrm{J}`,
      },
      {
        tex: 'U(x) = \\tfrac12 kx^2,\\quad K(x) = \\tfrac12 k(A^2 - x^2)',
        caption: 'Energy as a function of position — a parabola for U and its mirror for K. The E-vs-x graph plots exactly these expressions.',
        substitutedTex: `K = U \\;\\Leftrightarrow\\; x = \\pm A/\\sqrt2 = \\pm${formatValue(A / Math.SQRT2)}\\ \\mathrm{m}`,
      },
    ],
    [k, A, E],
  );

  const predictions = useMemo<PredictionScenario<EnergyParams>[]>(
    () => [
      {
        id: 'double-A',
        changeLabel: 'Double amplitude A',
        promptTex: 'The amplitude is doubled ($A \\to 2A$). What happens to the **total energy** $E = \\tfrac12 kA^2$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const E1 = totalOscillatorEnergy(p.k, p.A);
          const A2 = Math.min(RANGES.A.max, p.A * 2);
          const E2 = totalOscillatorEnergy(p.k, A2);
          return {
            correctOptionId: 'x4',
            explanation: `Computed from the model: $E_1 = ${formatValue(E1, 4)}\\ \\mathrm{J}$ at $A = ${formatValue(p.A)}\\ \\mathrm{m}$; $E_2 = ${formatValue(E2, 4)}\\ \\mathrm{J}$ at $A = ${formatValue(A2)}\\ \\mathrm{m}$ — ratio ${formatValue(E2 / Math.max(E1, 1e-12), 2)}. Because $E \\propto A^2$, doubling the amplitude quadruples the energy. The period is unchanged.`,
            applyTo: (q) => ({ ...q, A: A2 }),
          };
        },
      },
      {
        id: 'double-m',
        changeLabel: 'Double mass m',
        promptTex: 'The mass is doubled with $k$ and $A$ fixed. What happens to $E = \\tfrac12 kA^2$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'same', label: 'It stays the same' },
          { id: 'half', label: 'It halves' },
        ],
        evaluate: (p) => {
          const E1 = totalOscillatorEnergy(p.k, p.A);
          const m2 = Math.min(RANGES.m.max, p.m * 2);
          const w1 = shmAngularFrequency({ k: p.k, m: p.m });
          const w2 = shmAngularFrequency({ k: p.k, m: m2 });
          return {
            correctOptionId: 'same',
            explanation: `Computed: $E = \\tfrac12 kA^2 = ${formatValue(E1, 4)}\\ \\mathrm{J}$ does not contain $m$ — it is unchanged. But note $v_{max} = A\\omega$ drops from ${formatValue(p.A * w1)} to ${formatValue(p.A * w2)}\\ \\mathrm{m/s}$: the same energy is carried by a heavier, slower mass.`,
            applyTo: (q) => ({ ...q, m: m2 }),
          };
        },
      },
    ],
    [],
  );

  const marker = useMemo(() => ({ x: () => handle.clock.getTime(), label: 'now' }), [handle.clock]);
  const xMarker = useMemo(
    () => ({ x: () => energyAt(handle.clock.getTime()).x, label: 'x now', color: '#f472b6' }),
    [energyAt, handle.clock],
  );

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [1.9, 0.6, 3.4], fov: 45 }}
          ariaLabel="3D spring–mass oscillator; energy split is shown numerically and graphically below."
          fallback={<SpringFallbackSvg getState={getState} clock={handle.clock} />}
        >
          <SpringMassScene
            clock={handle.clock}
            getState={getState}
            showVectors={false}
            showForce={false}
            showRuler={true}
            controlsRef={controlsRef}
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={2 * T} />
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="scene-chip">
              E = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(energyAt(t).K + energyAt(t).U)} J`} />
            </span>
          </div>
          <div className="panel" style={{ padding: '10px 12px' }}>
            <EnergyBars clock={handle.clock} energyAt={(t) => { const e = energyAt(t); return { K: e.K, U: e.U, E: e.E }; }} />
          </div>
        </>
      }
      measurements={<Measurements items={measurements} clock={handle.clock} />}
      charts={
        <div className="charts-row">
          <Chart2D title="Energy vs time" xLabel="t (s)" yLabel="Energy (J)" series={timeSeries} clock={handle.clock} redrawKey={params} xDomain={[0, 2 * T]} marker={marker} precision={3} ariaSummary="Kinetic and potential energy oscillate out of phase while total energy stays constant." />
          <Chart2D title="Energy vs position" xLabel="x (m)" yLabel="Energy (J)" series={positionSeries} redrawKey={params} marker={xMarker} precision={3} ariaSummary="Potential energy is a parabola in x; kinetic energy is the gap between the parabola and the constant total-energy line." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Mass" symbol="m" unit="kg" value={m} min={0.1} max={5} step={0.05} onChange={(v) => setParam('m', v)} />
          <ParamSlider label="Spring constant" symbol="k" unit="N/m" value={k} min={1} max={200} step={1} precision={1} onChange={(v) => setParam('k', v)} />
          <ParamSlider label="Amplitude" symbol="A" unit="m" value={A} min={0.02} max={0.5} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
          <ParamSlider label="Phase constant" symbol="φ" unit="°" value={phiDeg} min={-180} max={180} step={1} precision={0} onChange={(v) => setParam('phiDeg', v)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> The energy bookkeeping of an ideal oscillator (§15.3):
            kinetic energy of the mass and elastic potential energy of the spring trade back and
            forth while the total stays exactly constant.
          </p>
          <p>
            <b>Assumptions.</b> No damping, massless spring, Hookean restoring force. In this ideal
            model E = ½kA² is conserved to machine precision — the flat green line is a consequence
            of the equations, not a drawn decoration.
          </p>
          <p>
            <b>Observe.</b> K peaks at equilibrium (x = 0); U peaks at the turning points (|x| = A);
            K = U exactly at x = ±A/√2. The E-vs-x graph shows U(x) as a parabola — the mass
            “rolls” between the two points where the parabola meets the E line.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'energy') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="oscillatory-motion" tabId="energy" params={params} defaultName="SHM energy lab" />}
    />
  );
}
