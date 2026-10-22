import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Camera } from 'lucide-react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { Scene3D } from '../../components/sim/Scene3D';
import { LiveValue } from '../../components/sim/LiveValue';
import { WaveCanvas2D } from '../../components/sim/WaveCanvas2D';
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
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { GuidedExperiment, PredictionScenario } from '../../education/types';
import { angularFrequency, waveNumber } from '../../physics/waves/travelling';
import {
  standingWaveAntinodes,
  standingWaveDisplacement,
  standingWaveEnvelope,
  standingWaveNodes,
} from '../../physics/interference/standing';
import { formatValue } from '../../utils/format';
import { Wave3D } from '../../components/three/Wave3D';

interface StandingParams {
  A: number; // amplitude of each travelling component [m]
  lambda: number; // wavelength of components [m]
  freq: number; // oscillation frequency [Hz]
  probeX: number;
  showEnvelope: boolean;
}

const X_MAX = 8;
const DEFAULTS: StandingParams = { A: 0.05, lambda: 2, freq: 0.8, probeX: 0.5, showEnvelope: true };
const RANGES = {
  A: { min: 0.01, max: 0.15 },
  lambda: { min: 0.5, max: 8 },
  freq: { min: 0.05, max: 4 },
  probeX: { min: 0, max: X_MAX },
};

const PRESETS: Preset<StandingParams>[] = [
  { id: 'default', label: 'Default', params: { ...DEFAULTS } },
  { id: 'long', label: 'Long wavelength', params: { ...DEFAULTS, lambda: 4 } },
  { id: 'short', label: 'Short wavelength', params: { ...DEFAULTS, lambda: 1 } },
  { id: 'fast', label: 'Fast oscillation', params: { ...DEFAULTS, freq: 2.5 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Nodes never move',
    objective: 'Verify node positions x = mπ/k = mλ/2.',
    setupLabel: 'λ = 2 m.',
    setup: { lambda: 2, A: 0.05, freq: 0.8 },
    predictionPrompt: 'How far apart are neighbouring nodes?',
    procedure: [
      'Play and watch several periods: find points that never move.',
      'Compare their positions with the node list in the measurements (λ/2 spacing).',
      'Change λ and re-check.',
    ],
    observe: 'Node spacing vs λ/2.',
    conclusionPrompt: 'Why must nodes be exactly half a wavelength apart?',
  },
  {
    id: 'g2',
    title: 'Antinodes swing between ±2A',
    objective: 'Measure the envelope amplitude.',
    setupLabel: 'A = 0.05 m components.',
    setup: { A: 0.05, lambda: 2, freq: 0.8, probeX: 0.5 },
    predictionPrompt: 'What is the maximum displacement of an antinode: A, 2A, or 4A?',
    procedure: [
      'Place the probe on an antinode (midway between nodes).',
      'Watch its time history: the peaks should reach 2A = envelope.',
      'Move the probe to a node: the history collapses to zero.',
    ],
    observe: 'Peak values of y(t) at antinode vs node.',
    conclusionPrompt: 'Connect to y = 2A sin(kx) cos(ωt): what does each factor control?',
  },
  {
    id: 'g3',
    title: 'Freeze and compare phases',
    objective: 'See that all points between two nodes oscillate in phase.',
    setupLabel: 'Defaults.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Are points in adjacent loops in phase or in opposite phase?',
    procedure: [
      'Use single-step to freeze at several instants.',
      'Compare the signs of y in neighbouring loops at the same instant.',
      'Step by a quarter period and compare again.',
    ],
    observe: 'Sign pattern across loops at frozen instants.',
    conclusionPrompt: 'Explain with the cos(ωt) factor being shared and sin(kx) flipping sign at nodes.',
  },
];

/** §18.2 — Standing waves. */
export default function StandingWaveLab() {
  const { params, setParam, applyParams } = useLabParams<StandingParams>(
    'interference',
    'standing',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { A, lambda, freq, probeX, showEnvelope } = params;

  const derived = useMemo(() => {
    const k = waveNumber(lambda);
    const omega = angularFrequency(freq);
    return {
      k,
      omega,
      standing: { amplitude: A, waveNumber: k, angularFrequency: omega },
      nodes: standingWaveNodes(k, 0, X_MAX),
      antinodes: standingWaveAntinodes(k, 0, X_MAX),
    };
  }, [A, lambda, freq]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const yAt = useCallback(
    (x: number, t: number) => standingWaveDisplacement(derived.standing, x, t),
    [derived.standing],
  );

  const profileSeries = useCallback((): ChartSeriesData[] => {
    const t = handle.clock.getTime();
    const N = 480;
    const d = new Float64Array(2 * N);
    const envU = new Float64Array(2 * N);
    const envD = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = (X_MAX * i) / (N - 1);
      d[2 * i] = envU[2 * i] = envD[2 * i] = x;
      d[2 * i + 1] = yAt(x, t);
      const env = showEnvelope ? standingWaveEnvelope(derived.standing, x) : NaN;
      envU[2 * i + 1] = env;
      envD[2 * i + 1] = -env;
    }
    return [
      { name: `y(x) at t = ${t.toFixed(2)} s`, color: COLORS.cyan, data: d },
      { name: '+envelope 2A|sin kx|', color: COLORS.amber, dash: [7, 4], data: showEnvelope ? envU : new Float64Array(0) },
      { name: '−envelope', color: COLORS.amber, dash: [7, 4], data: showEnvelope ? envD : new Float64Array(0) },
    ];
  }, [handle.clock, yAt, derived.standing, showEnvelope]);

  const probeSeries = useCallback((): ChartSeriesData[] => {
    const N = 420;
    const tEnd = 3 / freq;
    const d = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      d[2 * i] = t;
      d[2 * i + 1] = yAt(probeX, t);
    }
    return [{ name: `y(t) at x = ${formatValue(probeX)} m`, color: COLORS.violet, data: d }];
  }, [yAt, probeX, freq]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Component amplitude A', value: formatValue(A), unit: 'm' },
      { label: 'Max displacement 2A', value: formatValue(2 * A), unit: 'm', tone: 'amber' },
      { label: 'k = 2π/λ', value: formatValue(derived.k), unit: 'rad/m' },
      { label: 'ω = 2πf', value: formatValue(derived.omega), unit: 'rad/s' },
      { label: 'Node spacing λ/2', value: formatValue(lambda / 2), unit: 'm', tone: 'accent' },
      { label: 'Nodes in view', value: String(derived.nodes.length) },
      { label: 'Antinodes in view', value: String(derived.antinodes.length) },
      { label: 'Probe y', unit: 'm', live: (t) => formatValue(yAt(probeX, t)), tone: 'violet' },
      {
        label: 'Probe on node?',
        live: (t) => {
          void t;
          const atNode = derived.nodes.some((n) => Math.abs(n - probeX) < lambda / 100);
          const atAnti = derived.antinodes.some((n) => Math.abs(n - probeX) < lambda / 100);
          return atNode ? 'yes — always at rest' : atAnti ? 'antinode — full ±2A swing' : 'between node and antinode';
        },
      },
    ],
    [A, derived, lambda, yAt, probeX],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'standing-wave',
        tex: 'y(x,t) = 2A\\sin(kx)\\cos(\\omega t)',
        caption: 'Sum of two identical waves travelling in opposite directions: A sin(kx − ωt) + A sin(kx + ωt).',
        variables: [
          { sym: '2A', name: 'maximum envelope displacement', unit: `m (now ${formatValue(2 * A)})` },
          { sym: 'k', name: 'wave number', unit: `rad/m (now ${formatValue(derived.k)})` },
          { sym: '\\omega', name: 'angular frequency', unit: `rad/s (now ${formatValue(derived.omega)})` },
        ],
        substitutedTex: `y(x,t) = ${formatValue(2 * A)}\\sin(${formatValue(derived.k)}\\,x)\\cos(${formatValue(derived.omega)}\\,t)`,
      },
      {
        tex: '\\text{nodes: } x = m\\frac{\\lambda}{2},\\qquad \\text{antinodes: } x = \\left(m + \\tfrac12\\right)\\frac{\\lambda}{2},\\quad m = 0, 1, 2, \\dots',
        caption: 'Nodes are where sin(kx) = 0 — those points never move, at any time.',
        substitutedTex: `\\text{first nodes: } x = ${derived.nodes.slice(0, 5).map((n) => formatValue(n, 2)).join(',\\ ')},\\ \\dots\\ \\mathrm{m}`,
      },
    ],
    [A, derived],
  );

  const predictions = useMemo<PredictionScenario<StandingParams>[]>(
    () => [
      {
        id: 'half-lambda',
        changeLabel: 'Halve λ',
        promptTex: 'The component wavelength is halved. What happens to the **node spacing**?',
        options: [
          { id: 'half', label: 'It halves (nodes twice as dense)' },
          { id: 'same', label: 'It stays the same' },
          { id: 'double', label: 'It doubles' },
        ],
        evaluate: (p) => {
          const l2 = Math.max(RANGES.lambda.min, p.lambda / 2);
          return {
            correctOptionId: 'half',
            explanation: `Computed: node spacing is $\\lambda/2$: before ${formatValue(p.lambda / 2)} m, after ${formatValue(l2 / 2)} m — exactly half. $k$ doubles, so $\\sin(kx)$ completes a zero-to-zero cycle twice as often.`,
            applyTo: (q) => ({ ...q, lambda: l2 }),
          };
        },
      },
      {
        id: 'double-A',
        changeLabel: 'Double component A',
        promptTex: 'Each travelling component’s amplitude is doubled. What is the new **maximum displacement** at an antinode?',
        options: [
          { id: 'twoA', label: 'It doubles (envelope peak = 2A)' },
          { id: 'quad', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const A2 = Math.min(RANGES.A.max, p.A * 2);
          return {
            correctOptionId: 'twoA',
            explanation: `Computed: envelope peak is $2A$: before ${formatValue(2 * p.A)} m, after ${formatValue(2 * A2)} m — doubled, since the envelope is linear in the component amplitude. (The distractors are wrong: no squaring enters here.)`,
            applyTo: (q) => ({ ...q, A: A2 }),
          };
        },
      },
    ],
    [],
  );

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0, 1.7, 5.6], fov: 46 }}
          ariaLabel="3D standing wave on a string: loops oscillate between the dashed envelope curves while nodes stay at rest."
          fallback={
            <WaveCanvas2D
              clock={handle.clock}
              redrawKey={params}
              options={{
                yAt,
                xMin: 0,
                xMax: X_MAX,
                yMax: 2 * A,
                color: COLORS.cyan,
                height: 180,
                label: '2D standing wave (same model)',
                annotate: (ctx, toPx) => {
                  ctx.fillStyle = COLORS.red;
                  for (const n of derived.nodes) {
                    const [px, py] = toPx(n, 0);
                    ctx.beginPath();
                    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                },
              }}
            />
          }
        >
          <Wave3D
            clock={handle.clock}
            yAt={yAt}
            xMin={0}
            xMax={X_MAX}
            amplitude={2 * A}
            color="#22d3ee"
            particleXs={derived.nodes.slice(0, 12)}
            controlsRef={controlsRef}
            label="red markers = nodes (at rest by the model)"
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 / freq} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                y(probe) = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(yAt(probeX, t))} m`} />
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
          <Chart2D title="Standing-wave profile + envelope" xLabel="x (m)" yLabel="y (m)" ySymmetric series={profileSeries} clock={handle.clock} redrawKey={params} xDomain={[0, X_MAX]} marker={{ x: () => probeX, label: 'probe', color: COLORS.red }} precision={3} ariaSummary="The oscillating profile stays inside the fixed envelope; nodes touch zero." />
          <Chart2D title="Probe time history" xLabel="t (s)" yLabel="y (m)" ySymmetric series={probeSeries} clock={handle.clock} redrawKey={params} xDomain={[0, 3 / freq]} marker={{ x: () => handle.clock.getTime(), label: 'now' }} onPickX={(x) => handle.setTime(Math.max(0, Math.min(3 / freq, x)))} precision={3} ariaSummary="Displacement versus time at the probe; amplitude depends on probe position, zero at nodes." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Component amplitude" symbol="A" unit="m" value={A} min={0.01} max={0.15} step={0.005} precision={3} onChange={(v) => setParam('A', v)} tooltip="Amplitude of each of the two counter-propagating travelling waves; the envelope peak is 2A" />
          <ParamSlider label="Component wavelength" symbol="λ" unit="m" value={lambda} min={0.5} max={8} step={0.05} onChange={(v) => setParam('lambda', v)} />
          <ParamSlider label="Oscillation frequency" symbol="f" unit="Hz" value={freq} min={0.05} max={4} step={0.05} onChange={(v) => setParam('freq', v)} />
          <ParamSlider label="Probe position" symbol="x_probe" unit="m" value={probeX} min={0} max={X_MAX} step={0.05} onChange={(v) => setParam('probeX', v)} />
          <label className="checkbox-row">
            <input type="checkbox" checked={showEnvelope} onChange={(e) => setParam('showEnvelope', e.target.checked)} />
            Show ±envelope (2A|sin kx|)
          </label>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Two identical sinusoidal waves of amplitude A travelling in
            opposite directions interfere into a standing wave y = 2A sin(kx) cos(ωt): the spatial
            pattern sin(kx) is fixed, while everything oscillates in time with cos(ωt).
          </p>
          <p>
            <b>Assumptions.</b> Identical A, k, ω for both components; infinite/unbounded domain here
            (nodes fall at mλ/2 regardless of ends). §18.4 adds the boundary conditions that
            quantize which standing waves a finite string supports.
          </p>
          <p>
            <b>Observe.</b> Nodes (red markers) never move — sin(kx) = 0 there for all t. Antinodes
            swing the full ±2A. All points between two consecutive nodes share the same phase; the
            next loop is exactly out of phase.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      prediction={
        <PredictionPanel scenarios={predictions} getParams={() => ({ ...params })} applyParams={(p) => { applyParams(p); handle.reset(); }} />
      }
      investigations={<GuidedPanel experiments={GUIDED} onLoad={(s) => { applyParams(s); handle.reset(); }} />}
      practice={
        <PracticePanel
          moduleId="interference"
          generate={() => generateQuestion('interference')}
          onLoadToSim={(sp, target) => { if (!target || target === 'standing') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="interference" tabId="standing" params={params} defaultName="Standing wave" />}
    />
  );
}
