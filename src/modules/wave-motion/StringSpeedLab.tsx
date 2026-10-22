import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { Scene3D } from '../../components/sim/Scene3D';
import { WaveCanvas2D } from '../../components/sim/WaveCanvas2D';
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
  travellingWaveDisplacement,
  waveNumber,
  wavelengthFromSpeedAndFrequency,
} from '../../physics/waves/travelling';
import { stringWaveSpeed } from '../../physics/waves/string';
import { formatValue } from '../../utils/format';
import { Wave3D } from '../../components/three/Wave3D';

interface StringSpeedParams {
  tension: number; // N
  mu: number; // kg/m
  freq: number; // Hz (driving frequency)
  A: number; // m
}

const X_MAX = 6;
const DEFAULTS: StringSpeedParams = { tension: 80, mu: 0.02, freq: 1.2, A: 0.06 };
const RANGES = {
  tension: { min: 5, max: 400 },
  mu: { min: 0.002, max: 0.2 },
  freq: { min: 0.1, max: 6 },
  A: { min: 0.01, max: 0.2 },
};

const PRESETS: Preset<StringSpeedParams>[] = [
  { id: 'guitar', label: 'Guitar-like (tight, light)', params: { tension: 80, mu: 0.005, freq: 2, A: 0.04 } },
  { id: 'rope', label: 'Heavy rope (slack)', params: { tension: 20, mu: 0.12, freq: 0.8, A: 0.09 } },
  { id: 'default', label: 'Default', params: { ...DEFAULTS } },
  { id: 'tight', label: 'Very tight', params: { tension: 350, mu: 0.02, freq: 1.5, A: 0.05 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Tension vs wave speed (μ fixed)',
    objective: 'Measure the √T dependence of v.',
    setupLabel: 'μ = 0.02 kg/m fixed.',
    setup: { tension: 50, mu: 0.02, freq: 1.2, A: 0.06 },
    predictionPrompt: 'Quadrupling the tension multiplies v by 4, 2, or √2?',
    procedure: [
      'Record v for Tₛ = 50 N.',
      'Raise Tₛ to 200 N (×4); record v again.',
      'Compute the ratio and compare with the v-vs-T graph marker.',
    ],
    observe: 'v(50 N) and v(200 N); their ratio.',
    conclusionPrompt: 'Why does the graph of v vs Tₛ look like a square root, not a line?',
  },
  {
    id: 'g2',
    title: 'Density vs wave speed (T fixed)',
    objective: 'Verify v ∝ 1/√μ.',
    setupLabel: 'Tₛ = 80 N fixed.',
    setup: { tension: 80, mu: 0.02, freq: 1.2, A: 0.06 },
    predictionPrompt: 'A heavier (denser) string carries waves faster or slower at the same tension?',
    procedure: [
      'Record v at μ = 0.02 kg/m.',
      'Increase μ to 0.08 (×4); record v.',
      'Watch λ = v/f shrink on the spatial snapshot at fixed driving f.',
    ],
    observe: 'v ratio (expect ½) and λ change.',
    conclusionPrompt: 'Connect inertia (μ) to how fast a disturbance can be handed along the string.',
  },
  {
    id: 'g3',
    title: 'From medium speed to wavelength',
    objective: 'See λ = v(f)/f for a driven string.',
    setupLabel: 'Default.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'If the source frequency doubles on the same string, does λ halve?',
    procedure: [
      'Note v (medium property — unchanged by the source).',
      'Double f; observe λ in the measurements and the snapshot.',
    ],
    observe: 'λ before/after; v constant.',
    conclusionPrompt: 'Which quantities belong to the medium and which to the source?',
  },
];

/** §16.3 — The speed of waves on strings. */
export default function StringSpeedLab() {
  const { params, setParam, applyParams } = useLabParams<StringSpeedParams>(
    'wave-motion',
    'string-speed',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { tension, mu, freq, A } = params;

  const derived = useMemo(() => {
    const v = stringWaveSpeed(tension, mu);
    const lambda = wavelengthFromSpeedAndFrequency(v, freq);
    return {
      v,
      lambda,
      k: waveNumber(lambda),
      omega: angularFrequency(freq),
      T: 1 / freq,
    };
  }, [tension, mu, freq]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const yAt = useCallback(
    (x: number, t: number) =>
      travellingWaveDisplacement(
        { amplitude: A, wavelength: derived.lambda, frequency: freq, phase: 0, direction: 1 },
        x,
        t,
      ),
    [A, derived.lambda, freq],
  );

  const viewSpan = Math.min(X_MAX, Math.max(2 * derived.lambda, 1));

  // v(T) curve at fixed mu, with current-state marker.
  const vTensionSeries = useCallback((): ChartSeriesData[] => {
    const N = 240;
    const tMax = RANGES.tension.max;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const T = (tMax * i) / (N - 1);
      data[2 * i] = T;
      data[2 * i + 1] = stringWaveSpeed(Math.max(T, 1e-6), mu);
    }
    return [{ name: `v = √(Tₛ/μ), μ = ${formatValue(mu)} kg/m fixed`, color: COLORS.cyan, data }];
  }, [mu]);

  const vMuSeries = useCallback((): ChartSeriesData[] => {
    const N = 240;
    const muMax = RANGES.mu.max;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const m = 0.002 + ((muMax - 0.002) * i) / (N - 1);
      data[2 * i] = m;
      data[2 * i + 1] = stringWaveSpeed(tension, m);
    }
    return [{ name: `v = √(Tₛ/μ), Tₛ = ${formatValue(tension)} N fixed`, color: COLORS.violet, data }];
  }, [tension]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Tension Tₛ', value: formatValue(tension), unit: 'N' },
      { label: 'Density μ', value: formatValue(mu), unit: 'kg/m' },
      { label: 'Wave speed v', value: formatValue(derived.v), unit: 'm/s', tone: 'accent' },
      { label: 'Drive frequency f', value: formatValue(freq), unit: 'Hz' },
      { label: 'Resulting λ = v/f', value: formatValue(derived.lambda), unit: 'm', tone: 'amber' },
      { label: 'Period T = 1/f', value: formatValue(derived.T), unit: 's' },
      { label: 'k = 2π/λ', value: formatValue(derived.k), unit: 'rad/m' },
      { label: 'ω = 2πf', value: formatValue(derived.omega), unit: 'rad/s' },
    ],
    [tension, mu, freq, derived],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'string-v',
        tex: 'v = \\sqrt{\\frac{T_s}{\\mu}}',
        caption: 'The wave speed is a property of the MEDIUM (tension + inertia), independent of the source frequency.',
        variables: [
          { sym: 'T_s', name: 'string tension (not the period)', unit: `N (now ${formatValue(tension)})` },
          { sym: '\\mu', name: 'linear mass density', unit: `kg/m (now ${formatValue(mu)})` },
        ],
        substitutedTex: `v = \\sqrt{${formatValue(tension)}/${formatValue(mu)}} = ${formatValue(derived.v, 3)}\\ \\mathrm{m/s}`,
      },
      {
        id: 'wave-v',
        tex: '\\lambda = \\frac{v}{f}',
        caption: 'For a wave driven at frequency f on this string, the wavelength follows from the medium speed.',
        substitutedTex: `\\lambda = ${formatValue(derived.v, 3)}/${formatValue(freq)} = ${formatValue(derived.lambda, 3)}\\ \\mathrm{m}`,
      },
    ],
    [tension, mu, derived, freq],
  );

  const predictions = useMemo<PredictionScenario<StringSpeedParams>[]>(
    () => [
      {
        id: 'quad-T',
        changeLabel: 'Quadruple tension',
        promptTex: 'The tension is quadrupled with $\\mu$ fixed. What happens to $v = \\sqrt{T_s/\\mu}$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const v1 = stringWaveSpeed(p.tension, p.mu);
          const T2 = Math.min(RANGES.tension.max, p.tension * 4);
          const v2 = stringWaveSpeed(T2, p.mu);
          return {
            correctOptionId: 'x2',
            explanation: `Computed: $v_1 = ${formatValue(v1, 2)}\\ \\mathrm{m/s}$ at $T_s = ${formatValue(p.tension)}\\ \\mathrm{N}$; $v_2 = ${formatValue(v2, 2)}\\ \\mathrm{m/s}$ at $T_s = ${formatValue(T2)}\\ \\mathrm{N}$ — a factor of ${formatValue(v2 / v1, 3)} (= 2 when exactly quadrupled), because $v \\propto \\sqrt{T_s}$.`,
            applyTo: (q) => ({ ...q, tension: T2 }),
          };
        },
      },
      {
        id: 'quad-mu',
        changeLabel: 'Quadruple μ',
        promptTex: 'A string 4× denser replaces the current one (same tension). What happens to $v$?',
        options: [
          { id: 'half', label: 'It halves' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'quarter', label: 'It becomes one quarter' },
        ],
        evaluate: (p) => {
          const v1 = stringWaveSpeed(p.tension, p.mu);
          const mu2 = Math.min(RANGES.mu.max, p.mu * 4);
          const v2 = stringWaveSpeed(p.tension, mu2);
          return {
            correctOptionId: 'half',
            explanation: `Computed: $v_1 = ${formatValue(v1, 2)}$, $v_2 = ${formatValue(v2, 2)}\\ \\mathrm{m/s}$ — factor ${formatValue(v2 / v1, 3)} (= ½), since $v \\propto 1/\\sqrt{\\mu}$. More inertia per metre ⇒ slower hand-off of the disturbance.`,
            applyTo: (q) => ({ ...q, mu: mu2 }),
          };
        },
      },
    ],
    [],
  );

  // Comparison state for the "predict → change → compare" workflow.
  const [captured, setCaptured] = useState<{ tension: number; mu: number; v: number } | null>(null);

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0, 1.5, 5.2], fov: 46 }}
          ariaLabel="3D string carrying a sinusoidal wave whose speed is set by tension and linear density."
          fallback={
            <WaveCanvas2D
              clock={handle.clock}
              redrawKey={params}
              options={{ yAt, xMin: 0, xMax: viewSpan, yMax: A, color: COLORS.cyan, height: 170, label: '2D string wave (same model)' }}
            />
          }
        >
          <Wave3D
            clock={handle.clock}
            yAt={yAt}
            xMin={0}
            xMax={viewSpan}
            amplitude={A}
            color="#22d3ee"
            controlsRef={controlsRef}
            label={`v = √(Tₛ/μ) = ${formatValue(derived.v)} m/s · λ = v/f = ${formatValue(derived.lambda)} m`}
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 * derived.T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); setCaptured(null); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn sm"
                onClick={() => setCaptured({ tension, mu, v: derived.v })}
                title="Capture the current speed as a BEFORE reference, then change parameters and compare"
              >
                Capture “before”
              </button>
              <button type="button" className="btn ghost sm" onClick={() => controlsRef.current?.reset()}>
                <Camera size={13} /> Reset view
              </button>
            </span>
          </div>
          {captured && (
            <div className="callout" style={{ margin: 0 }}>
              <b>Before → after (computed live):</b> v was {formatValue(captured.v)} m/s at Tₛ ={' '}
              {formatValue(captured.tension)} N, μ = {formatValue(captured.mu)} kg/m. Now v ={' '}
              {formatValue(derived.v)} m/s — ratio{' '}
              <b>{formatValue(derived.v / Math.max(captured.v, 1e-12), 3)}</b>. Predicted ratio{' '}
              √(Tₛ/Tₛ₀)·√(μ₀/μ) ={' '}
              {formatValue(
                Math.sqrt(tension / captured.tension) * Math.sqrt(captured.mu / mu),
                3,
              )}
              .
            </div>
          )}
        </>
      }
      measurements={<Measurements items={measurements} clock={handle.clock} />}
      charts={
        <div className="charts-row">
          <Chart2D title="Wave speed vs tension (μ fixed)" xLabel="Tₛ (N)" yLabel="v (m/s)" series={vTensionSeries} redrawKey={mu} marker={{ x: () => tension, label: 'current' }} precision={1} ariaSummary="Square-root curve of wave speed versus tension at fixed linear density." />
          <Chart2D title="Wave speed vs density (Tₛ fixed)" xLabel="μ (kg/m)" yLabel="v (m/s)" series={vMuSeries} redrawKey={tension} marker={{ x: () => mu, label: 'current' }} precision={1} ariaSummary="Decreasing curve of wave speed versus linear mass density at fixed tension." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="String tension" symbol="Tₛ" unit="N" value={tension} min={5} max={400} step={1} precision={1} onChange={(v) => setParam('tension', v)} />
          <ParamSlider label="Linear mass density" symbol="μ" unit="kg/m" value={mu} min={0.002} max={0.2} step={0.001} precision={3} onChange={(v) => setParam('mu', v)} />
          <ParamSlider label="Driving frequency" symbol="f" unit="Hz" value={freq} min={0.1} max={6} step={0.05} onChange={(v) => setParam('freq', v)} tooltip="Set by the source; does NOT change the medium’s wave speed" />
          <ParamSlider label="Wave amplitude" symbol="A" unit="m" value={A} min={0.01} max={0.2} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
          <p className="prose" style={{ fontSize: '0.78rem' }}>
            Dependencies: <b>v</b> is fixed by (Tₛ, μ) — the medium. <b>λ</b> then follows from the
            source frequency: λ = v/f. Changing f cannot change v.
          </p>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> Transverse waves on an ideal stretched string. The speed is
            a <i>medium property</i>: v = √(Tₛ/μ). The source only chooses f (and A); the medium
            answers with λ = v/f.
          </p>
          <p>
            <b>Assumptions.</b> Perfectly flexible, uniform string; small-amplitude waves; no
            damping; tension constant along the string; μ ≪ total string mass effects ignored.
            Under these assumptions v is independent of frequency (non-dispersive).
          </p>
          <p>
            <b>Observe.</b> Higher tension ⇒ faster waves (√ scaling). Higher density ⇒ slower
            waves. The markers on both graphs show the current operating point.
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
          moduleId="wave-motion"
          generate={() => generateQuestion('wave-motion')}
          onLoadToSim={(sp, target) => { if (!target || target === 'string-speed') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="wave-motion" tabId="string-speed" params={params} defaultName="String wave speed" />}
    />
  );
}
