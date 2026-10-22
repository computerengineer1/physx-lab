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
  waveSpeedFromFrequencyAndWavelength,
  wavelengthFromSpeedAndFrequency,
} from '../../physics/waves/travelling';
import type { TravellingWaveParams, WaveDirection } from '../../physics/waves/travelling';
import { formatValue } from '../../utils/format';
import { Wave3D } from '../../components/three/Wave3D';

interface TravellingParams {
  mode: string; // 'free' (v = fλ) | 'fixedv' (λ = v/f)
  A: number;
  lambda: number;
  freq: number;
  phiDeg: number;
  direction: number;
  vFixed: number;
  probeX: number;
}

const X_MAX = 6;
const DEFAULTS: TravellingParams = {
  mode: 'free',
  A: 0.06,
  lambda: 2,
  freq: 0.8,
  phiDeg: 0,
  direction: 1,
  vFixed: 2,
  probeX: 3,
};
const RANGES = {
  A: { min: 0.01, max: 0.2 },
  lambda: { min: 0.25, max: 6 },
  freq: { min: 0.05, max: 5 },
  phiDeg: { min: -180, max: 180 },
  vFixed: { min: 0.2, max: 12 },
  probeX: { min: 0, max: X_MAX },
};

const PRESETS: Preset<TravellingParams>[] = [
  { id: 'default', label: 'Default wave', params: { ...DEFAULTS } },
  { id: 'lowf', label: 'Low frequency', params: { ...DEFAULTS, freq: 0.25, lambda: 4 } },
  { id: 'highf', label: 'High frequency', params: { ...DEFAULTS, freq: 3, lambda: 0.8 } },
  { id: 'left', label: 'Toward −x', params: { ...DEFAULTS, direction: -1 } },
  { id: 'fixedv', label: 'Fixed speed (string-like)', params: { ...DEFAULTS, mode: 'fixedv', vFixed: 2, freq: 1 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Wavelength, frequency and speed are linked',
    objective: 'Verify v = fλ and see which quantity is derived in each mode.',
    setupLabel: '“Fixed speed” mode with v = 2 m/s.',
    setup: { mode: 'fixedv', vFixed: 2, freq: 1, A: 0.06 },
    predictionPrompt: 'In fixed-speed mode, if you double f, what happens to λ?',
    procedure: [
      'Load the setup (fixed-speed mode). Note λ = v/f in the measurements.',
      'Double the driving frequency f.',
      'Observe λ and the spatial snapshot: more wave crests per metre, same crest speed.',
    ],
    observe: 'λ before/after and the unchanged crest speed.',
    conclusionPrompt: 'Why can f and λ NOT both be chosen freely when v is set by the medium?',
  },
  {
    id: 'g2',
    title: 'Reading the wave function from the graphs',
    objective: 'Extract A, λ, T and φ from the visualizations.',
    setupLabel: 'Free mode, φ = 0.',
    setup: { mode: 'free', A: 0.08, lambda: 2, freq: 0.5, phiDeg: 0 },
    predictionPrompt: 'What is the period T = 1/f before looking at the time graph?',
    procedure: [
      'Measure crest-to-crest distance on the spatial snapshot (≈ λ).',
      'Measure peak-to-peak time in the probe history (≈ T).',
      'Multiply them: does fλ equal the displayed v?',
    ],
    observe: 'Measured λ, T vs displayed values.',
    conclusionPrompt: 'Write y(x,t) with your measured numbers and compare to the equation panel.',
  },
  {
    id: 'g3',
    title: 'Phase and direction',
    objective: 'See how φ shifts the wave in space and how direction flips propagation.',
    setupLabel: 'Free mode.',
    setup: { mode: 'free', A: 0.06, lambda: 2, freq: 0.8, phiDeg: 0 },
    predictionPrompt: 'φ = +90° shifts the profile left or right by how much?',
    procedure: [
      'Note the crest nearest x = 0 at φ = 0 (paused).',
      'Set φ = +90° and locate that crest again; compute the shift (expect −λ/4).',
      'Flip direction to −x and re-run; note crest motion.',
    ],
    observe: 'Crest shift for φ, crest velocity sign for direction.',
    conclusionPrompt: 'Relate your observations to y = A sin(kx − ωt + φ) and y = A sin(kx + ωt + φ).',
  },
];

/** §16.2 — Analysis model: travelling wave. */
export default function TravellingWaveLab() {
  const { params, setParam, applyParams } = useLabParams<TravellingParams>(
    'wave-motion',
    'travelling',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { A, freq, phiDeg, probeX, mode, vFixed } = params;
  const dir = (params.direction >= 0 ? 1 : -1) as WaveDirection;

  const derived = useMemo(() => {
    const fixedV = mode === 'fixedv';
    const lambdaEff = fixedV ? wavelengthFromSpeedAndFrequency(vFixed, freq) : params.lambda;
    const vEff = fixedV ? vFixed : waveSpeedFromFrequencyAndWavelength(freq, lambdaEff);
    const waveParams: TravellingWaveParams = {
      amplitude: A,
      wavelength: lambdaEff,
      frequency: freq,
      phase: (phiDeg * Math.PI) / 180,
      direction: dir,
    };
    return {
      lambdaEff,
      vEff,
      k: waveNumber(lambdaEff),
      omega: angularFrequency(freq),
      T: 1 / freq,
      waveParams,
    };
  }, [mode, vFixed, freq, A, phiDeg, dir, params.lambda]);

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const yAt = useCallback(
    (x: number, t: number) => travellingWaveDisplacement(derived.waveParams, x, t),
    [derived.waveParams],
  );

  const viewSpan = Math.min(X_MAX, Math.max(2 * derived.lambdaEff, 1));

  const snapshotSeries = useCallback((): ChartSeriesData[] => {
    const t = handle.clock.getTime();
    const N = 420;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = (viewSpan * i) / (N - 1);
      data[2 * i] = x;
      data[2 * i + 1] = yAt(x, t);
    }
    return [{ name: `y(x) at t = ${t.toFixed(2)} s`, color: COLORS.cyan, data }];
  }, [handle.clock, yAt, viewSpan]);

  const probeSeries = useCallback((): ChartSeriesData[] => {
    const N = 420;
    const tEnd = 3 * derived.T;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      data[2 * i] = t;
      data[2 * i + 1] = yAt(probeX, t);
    }
    return [{ name: `y(t) at x = ${formatValue(probeX)} m`, color: COLORS.violet, data }];
  }, [yAt, probeX, derived.T]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Amplitude A', value: formatValue(A), unit: 'm' },
      { label: 'Wavelength λ', value: formatValue(derived.lambdaEff), unit: 'm', tone: 'accent' },
      { label: 'Frequency f', value: formatValue(freq), unit: 'Hz' },
      { label: 'Period T', value: formatValue(derived.T), unit: 's' },
      { label: 'Wave number k', value: formatValue(derived.k), unit: 'rad/m' },
      { label: 'Angular freq ω', value: formatValue(derived.omega), unit: 'rad/s' },
      {
        label: mode === 'fixedv' ? 'Speed v (fixed)' : 'Speed v = fλ',
        value: formatValue(derived.vEff),
        unit: 'm/s',
        tone: 'amber',
        title: mode === 'fixedv' ? 'Set by the medium; λ is derived as v/f' : 'Derived from f and λ',
      },
      { label: 'Direction', value: dir === 1 ? '+x' : '−x' },
      { label: 'Probe y', unit: 'm', live: (t) => formatValue(yAt(probeX, t)), tone: 'violet' },
      {
        label: 'Probe phase (kx−ωt+φ)',
        unit: 'rad',
        live: (t) =>
          formatValue(
            ((derived.k * probeX - dir * derived.omega * t + (phiDeg * Math.PI) / 180) %
              (2 * Math.PI) +
              2 * Math.PI) %
              (2 * Math.PI),
          ),
      },
    ],
    [A, derived, freq, dir, mode, yAt, probeX, phiDeg],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'wave-fn',
        tex: dir === 1 ? 'y(x,t) = A\\sin(kx - \\omega t + \\varphi)' : 'y(x,t) = A\\sin(kx + \\omega t + \\varphi)',
        caption: dir === 1 ? 'Travelling toward +x.' : 'Travelling toward −x.',
        variables: [
          { sym: 'A', name: 'amplitude', unit: `m (now ${formatValue(A)})` },
          { sym: 'k', name: 'wave number 2π/λ', unit: `rad/m (now ${formatValue(derived.k)})` },
          { sym: '\\omega', name: 'angular frequency 2πf', unit: `rad/s (now ${formatValue(derived.omega)})` },
          { sym: '\\varphi', name: 'phase constant', unit: `rad (now ${formatValue((phiDeg * Math.PI) / 180)})` },
        ],
        substitutedTex: `y(x,t) = ${formatValue(A)}\\sin(${formatValue(derived.k)}\\,x ${dir === 1 ? '-' : '+'} ${formatValue(derived.omega)}\\,t ${phiDeg >= 0 ? '+' : '−'} ${formatValue(Math.abs((phiDeg * Math.PI) / 180))})`,
      },
      {
        id: 'wave-v',
        tex: 'v = \\frac{\\omega}{k} = f\\lambda',
        caption:
          mode === 'fixedv'
            ? 'Mode: v is FIXED by the medium, so λ = v/f is derived — changing f changes λ, not v.'
            : 'Mode: f and λ are chosen independently, so v = fλ is the derived quantity.',
        substitutedTex: `v = ${formatValue(freq)} \\times ${formatValue(derived.lambdaEff)} = ${formatValue(derived.vEff)}\\ \\mathrm{m/s}`,
      },
      {
        id: 'wave-k-omega',
        tex: 'k = 2\\pi/\\lambda,\\quad \\omega = 2\\pi f',
        substitutedTex: `k = ${formatValue(derived.k, 3)}\\ \\mathrm{rad/m},\\quad \\omega = ${formatValue(derived.omega, 3)}\\ \\mathrm{rad/s}`,
      },
    ],
    [A, derived, freq, phiDeg, dir, mode],
  );

  const predictions = useMemo<PredictionScenario<TravellingParams>[]>(
    () => [
      {
        id: 'double-f',
        changeLabel: 'Double f (free mode)',
        promptTex:
          'In **free mode** (v = fλ derived), the frequency is doubled while λ is held. What happens to the wave speed $v$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'same', label: 'It stays the same' },
          { id: 'half', label: 'It halves' },
        ],
        evaluate: (p) => {
          const f2 = Math.min(RANGES.freq.max, p.freq * 2);
          const v1 = waveSpeedFromFrequencyAndWavelength(p.freq, p.lambda);
          const v2 = waveSpeedFromFrequencyAndWavelength(f2, p.lambda);
          return {
            correctOptionId: 'x2',
            explanation: `Computed: $v_1 = ${formatValue(p.freq)}\\cdot${formatValue(p.lambda)} = ${formatValue(v1)}\\ \\mathrm{m/s}$; $v_2 = ${formatValue(f2)}\\cdot${formatValue(p.lambda)} = ${formatValue(v2)}\\ \\mathrm{m/s}$. In free mode nothing constrains $v$ — it simply doubles with $f$. (In fixed-speed mode the same change would halve $\\lambda$ instead.)`,
            applyTo: (q) => ({ ...q, mode: 'free', freq: f2 }),
          };
        },
      },
      {
        id: 'flip-dir',
        changeLabel: 'Flip direction',
        promptTex: 'The propagation direction is switched from $+x$ to $-x$. What changes in $y = A\\sin(kx \\mp \\omega t + \\varphi)$?',
        options: [
          { id: 'sign', label: 'The sign of the ωt term (crests move the other way)' },
          { id: 'amp', label: 'The amplitude becomes negative' },
          { id: 'nothing', label: 'Nothing — direction is only cosmetic' },
        ],
        evaluate: (p) => ({
          correctOptionId: 'sign',
          explanation: `Model check at $x = 1, t = 0.3$: $y_{+x} = ${formatValue(travellingWaveDisplacement({ amplitude: p.A, wavelength: p.lambda, frequency: p.freq, phase: 0, direction: 1 }, 1, 0.3))}$ vs $y_{-x} = ${formatValue(travellingWaveDisplacement({ amplitude: p.A, wavelength: p.lambda, frequency: p.freq, phase: 0, direction: -1 }, 1, 0.3))}\\ \\mathrm{m}$ — different states, so direction is physical: it flips the sign of the $\\omega t$ term.`,
          applyTo: (q) => ({ ...q, direction: (q.direction >= 0 ? -1 : 1) }),
        }),
      },
    ],
    [],
  );

  const markerT = useMemo(() => ({ x: () => handle.clock.getTime(), label: 'now' }), [handle.clock]);

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0, 1.5, 5.2], fov: 46 }}
          ariaLabel="3D sinusoidal travelling wave on a string; the profile moves horizontally while string points move vertically."
          fallback={
            <WaveCanvas2D
              clock={handle.clock}
              redrawKey={params}
              options={{ yAt, xMin: 0, xMax: viewSpan, yMax: A, color: COLORS.cyan, height: 170, label: '2D wave profile (same model)' }}
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
            label={`v = ${formatValue(derived.vEff)} m/s toward ${dir === 1 ? '+x' : '−x'}`}
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 * derived.T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                λ = {formatValue(derived.lambdaEff)} m
              </span>
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
          <Chart2D title="Spatial profile y(x) at the current time" xLabel="x (m)" yLabel="y (m)" ySymmetric series={snapshotSeries} clock={handle.clock} redrawKey={params} xDomain={[0, viewSpan]} marker={{ x: () => probeX, label: 'probe', color: COLORS.amber }} precision={2} ariaSummary="Sinusoidal spatial profile; one wavelength spans the distance between neighbouring crests." />
          <Chart2D title="Time history at the probe position" xLabel="t (s)" yLabel="y (m)" ySymmetric series={probeSeries} redrawKey={params} clock={handle.clock} xDomain={[0, 3 * derived.T]} marker={markerT} onPickX={(x) => handle.setTime(Math.max(0, Math.min(3 * derived.T, x)))} precision={2} ariaSummary="Displacement versus time of the particle at the probe position — a sinusoid of period T." />
        </div>
      }
      controls={
        <>
          <div className="field">
            <span className="field-label">
              Constraint mode
              <span className="unit-tag">{mode === 'fixedv' ? 'v fixed ⇒ λ = v/f' : 'f, λ free ⇒ v = fλ'}</span>
            </span>
            <div className="segmented" role="group" aria-label="Constraint mode">
              <button type="button" aria-pressed={mode === 'free'} onClick={() => setParam('mode', 'free')}>Free (v derived)</button>
              <button type="button" aria-pressed={mode === 'fixedv'} onClick={() => setParam('mode', 'fixedv')}>Fixed speed</button>
            </div>
          </div>
          <ParamSlider label="Amplitude" symbol="A" unit="m" value={A} min={0.01} max={0.2} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
          <ParamSlider label="Wavelength" symbol="λ" unit="m" value={derived.lambdaEff} min={0.25} max={6} step={0.05} precision={2} disabled={mode === 'fixedv'} onChange={(v) => setParam('lambda', v)} tooltip={mode === 'fixedv' ? 'In fixed-speed mode λ is computed as v/f' : 'Spatial period of the wave'} />
          <ParamSlider label="Frequency" symbol="f" unit="Hz" value={freq} min={0.05} max={5} step={0.05} onChange={(v) => setParam('freq', v)} />
          {mode === 'fixedv' && (
            <ParamSlider label="Fixed wave speed" symbol="v" unit="m/s" value={vFixed} min={0.2} max={12} step={0.1} onChange={(v) => setParam('vFixed', v)} tooltip="Set by the medium (e.g. by tension and density of a string — see §16.3)" />
          )}
          <ParamSlider label="Phase constant" symbol="φ" unit="°" value={phiDeg} min={-180} max={180} step={1} precision={0} onChange={(v) => setParam('phiDeg', v)} />
          <ParamSlider label="Probe position" symbol="x_probe" unit="m" value={probeX} min={0} max={X_MAX} step={0.05} onChange={(v) => setParam('probeX', v)} />
          <div className="field">
            <span className="field-label">Direction</span>
            <div className="segmented" role="group" aria-label="Propagation direction">
              <button type="button" aria-pressed={dir === 1} onClick={() => setParam('direction', 1)}>+x</button>
              <button type="button" aria-pressed={dir === -1} onClick={() => setParam('direction', -1)}>−x</button>
            </div>
          </div>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> A sinusoidal travelling wave — the §16.2 analysis model.
            Each medium particle executes SHM about its rest position while the pattern translates
            at v.
          </p>
          <p>
            <b>Constraint transparency.</b> Only two of (v, f, λ) are independent because v = fλ.
            In <b>free mode</b> you choose f and λ and the app derives v. In <b>fixed-speed mode</b>
            (what a real string does — its v is set by tension and density) you choose v and f, and
            λ = v/f is derived; the λ slider is disabled to make the dependency explicit.
          </p>
          <p>
            <b>Assumptions.</b> Ideal sinusoidal wave in a uniform, lossless, non-dispersive medium;
            small transverse displacements.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'travelling') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="wave-motion" tabId="travelling" params={params} defaultName="Travelling wave" />}
    />
  );
}
