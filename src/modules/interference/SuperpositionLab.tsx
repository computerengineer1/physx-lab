import { useCallback, useEffect, useMemo } from 'react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
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
import type { GuidedExperiment, PredictionScenario } from '../../education/types';
import {
  angularFrequency,
  componentDisplacement,
  waveNumber,
} from '../../physics/waves/travelling';
import type { WaveComponent } from '../../physics/waves/travelling';
import {
  classifyInterference,
  resultantAmplitude,
  superpose,
} from '../../physics/interference/superposition';
import { formatValue } from '../../utils/format';

interface SupParams {
  a1: number;
  a2: number;
  lambda: number;
  freq: number;
  dphi: number; // degrees, wave 2 relative to wave 1
  probeX: number;
  showW1: boolean;
  showW2: boolean;
  showTotal: boolean;
}

const X_MAX = 8;
const DEFAULTS: SupParams = {
  a1: 0.05,
  a2: 0.05,
  lambda: 2,
  freq: 0.6,
  dphi: 0,
  probeX: 1,
  showW1: true,
  showW2: true,
  showTotal: true,
};
const RANGES = {
  a1: { min: 0, max: 0.15 },
  a2: { min: 0, max: 0.15 },
  lambda: { min: 0.5, max: 6 },
  freq: { min: 0.05, max: 4 },
  dphi: { min: -180, max: 180 },
  probeX: { min: 0, max: X_MAX },
};

const PRESETS: Preset<SupParams>[] = [
  { id: 'inphase', label: 'In phase (Δφ = 0)', params: { ...DEFAULTS, dphi: 0 } },
  { id: 'opposite', label: 'Opposite phase (Δφ = 180°)', params: { ...DEFAULTS, dphi: 180 } },
  { id: 'ninety', label: 'Δφ = 90°', params: { ...DEFAULTS, dphi: 90 } },
  { id: 'unequal', label: 'Unequal amplitudes (2:1)', params: { ...DEFAULTS, a1: 0.08, a2: 0.04, dphi: 180 } },
  { id: 'third', label: 'Δφ = 120°', params: { ...DEFAULTS, dphi: 120 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'From constructive to destructive',
    objective: 'Map the resultant amplitude across Δφ from 0 to 180°.',
    setupLabel: 'Equal amplitudes A = 0.05 m.',
    setup: { a1: 0.05, a2: 0.05, dphi: 0 },
    predictionPrompt: 'At which Δφ does the resultant vanish entirely?',
    procedure: [
      'Start at Δφ = 0; note A_R in the measurements (expect A₁ + A₂).',
      'Step Δφ in 30° increments to 180°; record A_R each time.',
      'Compare with A_R = √(A₁² + A₂² + 2A₁A₂ cos Δφ).',
    ],
    observe: 'A_R(Δφ) table; the classification badge (constructive/partial/destructive).',
    conclusionPrompt: 'Sketch A_R vs Δφ from your data. Where are the extremes and why?',
  },
  {
    id: 'g2',
    title: 'Unequal amplitudes never fully cancel',
    objective: 'Show that full destructive interference needs A₁ = A₂.',
    setupLabel: 'A₁ = 0.08 m, A₂ = 0.04 m.',
    setup: { a1: 0.08, a2: 0.04, dphi: 180 },
    predictionPrompt: 'With Δφ = 180°, is the resultant zero?',
    procedure: [
      'Set Δφ = 180°; read A_R (expect |A₁ − A₂| = 0.04 m, not 0).',
      'Adjust A₂ until the resultant vanishes; note the condition.',
    ],
    observe: 'Minimum achievable A_R and the amplitudes at which it occurs.',
    conclusionPrompt: 'State the exact condition for full cancellation.',
  },
  {
    id: 'g3',
    title: 'Superposition is pointwise addition',
    objective: 'Verify y_total = y₁ + y₂ at sampled points.',
    setupLabel: 'Δφ = 90°, unequal amplitudes.',
    setup: { a1: 0.07, a2: 0.04, dphi: 90 },
    predictionPrompt: 'Can the total ever exceed A₁ + A₂?',
    procedure: [
      'Pause the simulation.',
      'Read y₁, y₂ and y_total at the probe from the live measurements.',
      'Move the probe to several positions; check the sum each time.',
    ],
    observe: 'Triples (y₁, y₂, y_total) at ≥ 4 probe positions.',
    conclusionPrompt: 'Why can waves pass through each other unchanged in a linear medium?',
  },
];

/** §18.1 — Analysis model: waves in interference. */
export default function SuperpositionLab() {
  const { params, setParam, applyParams } = useLabParams<SupParams>(
    'interference',
    'superposition',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const { a1, a2, lambda, freq, dphi, probeX, showW1, showW2, showTotal } = params;

  const components = useMemo<{ w1: WaveComponent; w2: WaveComponent }>(() => {
    const k = waveNumber(lambda);
    const omega = angularFrequency(freq);
    return {
      w1: { amplitude: a1, waveNumber: k, angularFrequency: omega, phase: 0, direction: 1 },
      w2: {
        amplitude: a2,
        waveNumber: k,
        angularFrequency: omega,
        phase: (dphi * Math.PI) / 180,
        direction: 1,
      },
    };
  }, [a1, a2, lambda, freq, dphi]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const AR = useMemo(
    () => resultantAmplitude(a1, a2, (dphi * Math.PI) / 180),
    [a1, a2, dphi],
  );
  const kind = useMemo(() => classifyInterference(a1, a2, (dphi * Math.PI) / 180), [a1, a2, dphi]);

  const snapshot = useCallback((): ChartSeriesData[] => {
    const t = handle.clock.getTime();
    const N = 480;
    const d1 = new Float64Array(2 * N);
    const d2 = new Float64Array(2 * N);
    const dt = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = (X_MAX * i) / (N - 1);
      d1[2 * i] = d2[2 * i] = dt[2 * i] = x;
      d1[2 * i + 1] = showW1 ? componentDisplacement(components.w1, x, t) : NaN;
      d2[2 * i + 1] = showW2 ? componentDisplacement(components.w2, x, t) : NaN;
      dt[2 * i + 1] = showTotal ? superpose([components.w1, components.w2], x, t) : NaN;
    }
    return [
      { name: 'y₁ (wave 1)', color: COLORS.cyan, data: showW1 ? d1 : new Float64Array(0) },
      { name: 'y₂ (wave 2)', color: COLORS.violet, dash: [7, 4], data: showW2 ? d2 : new Float64Array(0) },
      { name: 'y₁ + y₂ (resultant)', color: COLORS.amber, data: showTotal ? dt : new Float64Array(0) },
    ];
  }, [components, handle.clock, showW1, showW2, showTotal]);

  const probeHistory = useCallback((): ChartSeriesData[] => {
    const N = 420;
    const tEnd = 3 / freq;
    const d1 = new Float64Array(2 * N);
    const d2 = new Float64Array(2 * N);
    const dt = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      d1[2 * i] = d2[2 * i] = dt[2 * i] = t;
      d1[2 * i + 1] = componentDisplacement(components.w1, probeX, t);
      d2[2 * i + 1] = componentDisplacement(components.w2, probeX, t);
      dt[2 * i + 1] = superpose([components.w1, components.w2], probeX, t);
    }
    return [
      { name: 'y₁(t) at probe', color: COLORS.cyan, data: d1 },
      { name: 'y₂(t) at probe', color: COLORS.violet, dash: [7, 4], data: d2 },
      { name: 'resultant(t)', color: COLORS.amber, data: dt },
    ];
  }, [components, probeX, freq]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Resultant amplitude A_R', value: formatValue(AR), unit: 'm', tone: 'amber' },
      {
        label: 'Interference type',
        value: kind,
        tone: kind === 'fully destructive' ? 'red' : kind === 'fully constructive' ? 'green' : undefined,
      },
      { label: 'Δφ', value: `${formatValue(dphi, 0)}° = ${formatValue((dphi * Math.PI) / 180)} rad` },
      { label: 'A₁ + A₂ (max possible)', value: formatValue(a1 + a2), unit: 'm' },
      { label: '|A₁ − A₂| (min possible)', value: formatValue(Math.abs(a1 - a2)), unit: 'm' },
      { label: 'y₁ at probe', unit: 'm', live: (t) => formatValue(componentDisplacement(components.w1, probeX, t)), tone: 'accent' },
      { label: 'y₂ at probe', unit: 'm', live: (t) => formatValue(componentDisplacement(components.w2, probeX, t)), tone: 'violet' },
      { label: 'y_total at probe', unit: 'm', live: (t) => formatValue(superpose([components.w1, components.w2], probeX, t)), tone: 'amber' },
    ],
    [AR, kind, dphi, a1, a2, components, probeX],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'superposition',
        tex: 'y_{total}(x,t) = y_1(x,t) + y_2(x,t)',
        caption: 'Superposition principle in a linear medium — pointwise addition, components inspectable separately.',
      },
      {
        id: 'resultant-amp',
        tex: 'A_R = \\sqrt{A_1^2 + A_2^2 + 2A_1A_2\\cos\\Delta\\varphi}',
        variables: [
          { sym: 'A_1', name: 'amplitude of wave 1', unit: `m (now ${formatValue(a1)})` },
          { sym: 'A_2', name: 'amplitude of wave 2', unit: `m (now ${formatValue(a2)})` },
          { sym: '\\Delta\\varphi', name: 'phase difference', unit: `rad (now ${formatValue((dphi * Math.PI) / 180)})` },
        ],
        substitutedTex: `A_R = \\sqrt{(${formatValue(a1)})^2 + (${formatValue(a2)})^2 + 2(${formatValue(a1)})(${formatValue(a2)})\\cos(${formatValue(dphi, 0)}^\\circ)} = ${formatValue(AR, 4)}\\ \\mathrm{m}`,
      },
    ],
    [a1, a2, dphi, AR],
  );

  const predictions = useMemo<PredictionScenario<SupParams>[]>(
    () => [
      {
        id: 'to180',
        changeLabel: 'Δφ: 0 → 180°',
        promptTex: 'Starting from equal in-phase waves, the phase difference is set to $180^\\circ$. What happens to the resultant amplitude?',
        options: [
          { id: 'zero', label: 'It drops to zero (full cancellation)' },
          { id: 'double', label: 'It doubles' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const before = resultantAmplitude(p.a1, p.a2, (p.dphi * Math.PI) / 180);
          const after = resultantAmplitude(p.a1, p.a2, Math.PI);
          return {
            correctOptionId: Math.abs(p.a1 - p.a2) < 1e-9 ? 'zero' : 'zero',
            explanation: `Computed: $A_R$ goes from ${formatValue(before)} to ${formatValue(after)}\\ \\mathrm{m}$. ${Math.abs(p.a1 - p.a2) < 1e-9 ? 'With equal amplitudes this is exact cancellation — crest meets trough everywhere.' : `With unequal amplitudes (A₁=${formatValue(p.a1)}, A₂=${formatValue(p.a2)}) the minimum is |A₁−A₂| = ${formatValue(Math.abs(p.a1 - p.a2))} m, not zero — the classification badge shows the honest result.`}`,
            applyTo: (q) => ({ ...q, dphi: 180 }),
          };
        },
      },
      {
        id: 'to90',
        changeLabel: 'Δφ → 90°',
        promptTex: 'Equal amplitudes $A_1 = A_2 = A$ with $\\Delta\\varphi = 90^\\circ$: what is $A_R$?',
        options: [
          { id: 'sqrt2', label: 'A√2 ≈ 1.41 A' },
          { id: 'two', label: '2A' },
          { id: 'zero', label: '0' },
        ],
        evaluate: (p) => {
          const after = resultantAmplitude(p.a1, p.a2, Math.PI / 2);
          const ratio = p.a1 > 0 && Math.abs(p.a1 - p.a2) < 1e-9 ? after / p.a1 : NaN;
          return {
            correctOptionId: 'sqrt2',
            explanation: `Computed: $A_R = ${formatValue(after, 4)}\\ \\mathrm{m}$. ${Number.isFinite(ratio) ? `For equal amplitudes the ratio is ${formatValue(ratio, 3)} = √2, from $A_R = A\\sqrt{2 + 2\\cos 90^\\circ} = A\\sqrt2$.` : 'With the current unequal amplitudes, compare A_R against √(A₁²+A₂²) — the phasor sum at 90°.'}`,
            applyTo: (q) => ({ ...q, dphi: 90 }),
          };
        },
      },
    ],
    [],
  );

  return (
    <LabLayout
      scene={
        <div className="panel">
          <div className="panel-title">
            Interference of two co-propagating sinusoidal waves (same medium, same k and ω)
            <span style={{ flex: 1 }} />
            <span className="scene-chip">
              A_R = {formatValue(AR)} m · {kind}
            </span>
          </div>
          <p className="prose" style={{ fontSize: '0.82rem', marginTop: 0 }}>
            Solid cyan = wave 1, dashed violet = wave 2, solid amber = resultant. Components are
            always inspectable separately (toggle below) — the resultant is their pointwise sum,
            computed at every sample. Line styles differ so the plot does not rely on color alone.
          </p>
          <div className="row">
            <label className="checkbox-row">
              <input type="checkbox" checked={showW1} onChange={(e) => setParam('showW1', e.target.checked)} /> Wave 1
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={showW2} onChange={(e) => setParam('showW2', e.target.checked)} /> Wave 2
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={showTotal} onChange={(e) => setParam('showTotal', e.target.checked)} /> Resultant
            </label>
            <span style={{ flex: 1 }} />
            <span className="scene-chip">
              y_total(probe) ={' '}
              <LiveValue
                clock={handle.clock}
                compute={(t) => `${formatValue(superpose([components.w1, components.w2], probeX, t))} m`}
              />
            </span>
          </div>
        </div>
      }
      toolbar={<PlaybackToolbar handle={handle} scrubMax={3 / freq} />}
      measurements={<Measurements items={measurements} clock={handle.clock} />}
      charts={
        <div className="charts-row">
          <Chart2D title="Spatial snapshot at the current time" xLabel="x (m)" yLabel="y (m)" ySymmetric series={snapshot} clock={handle.clock} redrawKey={params} xDomain={[0, X_MAX]} marker={{ x: () => probeX, label: 'probe' }} precision={3} ariaSummary="Two component sinusoids and their pointwise sum along the string at the current instant." />
          <Chart2D title="Time histories at the probe position" xLabel="t (s)" yLabel="y (m)" ySymmetric series={probeHistory} clock={handle.clock} redrawKey={params} xDomain={[0, 3 / freq]} marker={{ x: () => handle.clock.getTime(), label: 'now' }} onPickX={(x) => handle.setTime(Math.max(0, x))} precision={3} ariaSummary="Displacement versus time of both components and the resultant at the probe point." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Amplitude A₁" symbol="A₁" unit="m" value={a1} min={0} max={0.15} step={0.005} precision={3} onChange={(v) => setParam('a1', v)} />
          <ParamSlider label="Amplitude A₂" symbol="A₂" unit="m" value={a2} min={0} max={0.15} step={0.005} precision={3} onChange={(v) => setParam('a2', v)} />
          <ParamSlider label="Wavelength (shared)" symbol="λ" unit="m" value={lambda} min={0.5} max={6} step={0.05} onChange={(v) => setParam('lambda', v)} tooltip="Both waves share λ and f, so a constant phase difference Δφ is well defined" />
          <ParamSlider label="Frequency (shared)" symbol="f" unit="Hz" value={freq} min={0.05} max={4} step={0.05} onChange={(v) => setParam('freq', v)} />
          <ParamSlider label="Phase difference (wave 2 rel. wave 1)" symbol="Δφ" unit="°" value={dphi} min={-180} max={180} step={1} precision={0} onChange={(v) => setParam('dphi', v)} />
          <ParamSlider label="Probe position" symbol="x_probe" unit="m" value={probeX} min={0} max={X_MAX} step={0.05} onChange={(v) => setParam('probeX', v)} />
          <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Two sinusoidal waves travelling in the <i>same</i> direction
            through the same linear medium, differing only in amplitude and constant phase. Their
            sum is another sinusoid of the same k and ω with amplitude A_R and a shifted phase.
          </p>
          <p>
            <b>Assumptions.</b> Linear medium (superposition holds exactly); identical frequency and
            wavelength for both components so Δφ is constant in time and space; no reflections.
          </p>
          <p>
            <b>Observe.</b> Constructive (Δφ = 0): A_R = A₁ + A₂. Destructive (Δφ = 180°): A_R =
            |A₁ − A₂|, which is zero only for equal amplitudes. In between, the phasor rule
            interpolates smoothly.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'superposition') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="interference" tabId="superposition" params={params} defaultName="Two-wave interference" />}
    />
  );
}
