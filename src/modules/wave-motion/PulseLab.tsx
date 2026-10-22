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
import { PracticePanel } from '../../components/education/PracticePanel';
import { useSimClock } from '../../simulation/useSimClock';
import { useLabParams } from '../../hooks/useLabParams';
import { generateQuestion } from '../../education/questions';
import type { GuidedExperiment } from '../../education/types';
import { pulseDisplacement } from '../../physics/waves/travelling';
import type { WaveDirection } from '../../physics/waves/travelling';
import { formatValue } from '../../utils/format';
import { Wave3D } from '../../components/three/Wave3D';

interface PulseParams {
  A: number; // pulse height [m]
  v: number; // propagation speed [m/s]
  sigma: number; // pulse width [m]
  probeX: number; // tracked medium particle [m]
  direction: number; // 1 | -1 stored as number for storage simplicity
  showParticles: boolean;
}

const X_MIN = 0;
const X_MAX = 8;
const PULSE_START = 1.2;

const DEFAULTS: PulseParams = {
  A: 0.12,
  v: 1.6,
  sigma: 0.35,
  probeX: 4.5,
  direction: 1,
  showParticles: true,
};
const RANGES = {
  A: { min: 0.02, max: 0.3 },
  v: { min: 0.2, max: 5 },
  sigma: { min: 0.15, max: 1.2 },
  probeX: { min: X_MIN, max: X_MAX },
};

const PRESETS: Preset<PulseParams>[] = [
  { id: 'default', label: 'Default pulse', params: { ...DEFAULTS } },
  { id: 'narrow', label: 'Narrow flick', params: { ...DEFAULTS, sigma: 0.18, v: 2.4 } },
  { id: 'wide', label: 'Broad displacement', params: { ...DEFAULTS, sigma: 0.9, v: 1.0 } },
  { id: 'left', label: 'Travelling toward −x', params: { ...DEFAULTS, direction: -1 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Particles oscillate; the pulse travels',
    objective: 'Distinguish medium motion from disturbance motion.',
    setupLabel: 'Default pulse with particle markers visible.',
    setup: { ...DEFAULTS, showParticles: true },
    predictionPrompt: 'As the pulse passes a marked particle, does that particle travel along with it?',
    procedure: [
      'Pick a tracked particle position (probeX) ahead of the pulse.',
      'Play and watch the amber markers: they move up and down, not sideways.',
      'Watch the probe’s y(t) history graph: it returns to zero after the pulse passes.',
    ],
    observe: 'Net sideways displacement of a particle after the pulse passed (zero).',
    conclusionPrompt: 'In one sentence: what moves at speed v, and what does each medium particle do?',
  },
  {
    id: 'g2',
    title: 'Shape is preserved; only position changes',
    objective: 'Verify rigid propagation y(x, t) = f(x − vt).',
    setupLabel: 'Narrow flick preset.',
    setup: { sigma: 0.18, v: 2.4, A: 0.12, probeX: 4.5 },
    predictionPrompt: 'Does the pulse broaden, shrink, or keep its shape while moving?',
    procedure: [
      'Pause at t ≈ 0.5 s and note the peak position.',
      'Pause at t ≈ 2 s and note the peak position and height.',
      'Check: peak moved by v·Δt and kept height A.',
    ],
    observe: 'Peak position at two instants vs v·Δt prediction.',
    conclusionPrompt: 'Why does the ideal model keep the shape exactly?',
  },
  {
    id: 'g3',
    title: 'Direction reversal',
    objective: 'Connect the sign in f(x ∓ vt) with propagation direction.',
    setupLabel: 'Default.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Switching to −x propagation mirrors which part of the picture?',
    procedure: [
      'Run toward +x; note the peak trajectory.',
      'Switch direction to −x and re-run from t = 0.',
      'Compare with the y(t) history of the same probe in both runs.',
    ],
    observe: 'Time at which the probe is disturbed in each direction.',
    conclusionPrompt: 'Explain using x − vt vs x + vt.',
  },
];

/** §16.1 — Propagation of a disturbance. */
export default function PulseLab() {
  const { params, setParam, applyParams } = useLabParams<PulseParams>(
    'wave-motion',
    'pulse',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { A, v, sigma, probeX, showParticles } = params;
  const dir = (params.direction >= 0 ? 1 : -1) as WaveDirection;

  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const yAt = useCallback(
    (x: number, t: number) => pulseDisplacement(A, PULSE_START, v, sigma, dir, x, t),
    [A, v, sigma, dir],
  );

  const traverseTime = (X_MAX - X_MIN + 4 * sigma) / v + 1;

  const particleXs = useMemo(() => {
    if (!showParticles) return undefined;
    const n = 16;
    return Array.from({ length: n }, (_, i) => X_MIN + ((X_MAX - X_MIN) * (i + 0.5)) / n);
  }, [showParticles]);

  const snapshotSeries = useCallback((): ChartSeriesData[] => {
    const t = handle.clock.getTime();
    const N = 400;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / (N - 1);
      data[2 * i] = x;
      data[2 * i + 1] = yAt(x, t);
    }
    return [{ name: `y(x) at t = ${t.toFixed(2)} s`, color: COLORS.cyan, data }];
  }, [handle.clock, yAt]);

  const probeHistory = useCallback((): ChartSeriesData[] => {
    const N = 400;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (traverseTime * i) / (N - 1);
      data[2 * i] = t;
      data[2 * i + 1] = yAt(probeX, t);
    }
    return [{ name: `y(t) of particle at x = ${formatValue(probeX)} m`, color: COLORS.violet, data }];
  }, [yAt, probeX, traverseTime]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Pulse speed v', value: formatValue(v), unit: 'm/s', tone: 'accent' },
      { label: 'Height A', value: formatValue(A), unit: 'm' },
      { label: 'Width σ', value: formatValue(sigma), unit: 'm' },
      { label: 'Direction', value: dir === 1 ? 'toward +x' : 'toward −x' },
      { label: 'Peak position', unit: 'm', live: (t) => formatValue(PULSE_START + dir * v * t), tone: 'amber' },
      { label: 'Probe displacement y', unit: 'm', live: (t) => formatValue(yAt(probeX, t)), tone: 'violet' },
    ],
    [v, A, sigma, dir, yAt, probeX],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        tex: 'y(x,t) = A\\,e^{-\\frac{(x - x_0 - vt)^2}{2\\sigma^2}}',
        caption: 'Gaussian pulse travelling toward +x at constant speed v without changing shape (ideal, non-dispersive medium). For −x propagation the argument becomes x − x₀ + vt.',
        variables: [
          { sym: 'A', name: 'pulse height', unit: `m (now ${formatValue(A)})` },
          { sym: 'x_0', name: 'initial peak position', unit: `m (fixed at ${PULSE_START})` },
          { sym: 'v', name: 'propagation speed', unit: `m/s (now ${formatValue(v)})` },
          { sym: '\\sigma', name: 'pulse width', unit: `m (now ${formatValue(sigma)})` },
        ],
        substitutedTex: `\\text{peak}(t) = x_0 + vt = ${PULSE_START} + ${formatValue(v)}\\,t`,
      },
    ],
    [A, v, sigma],
  );

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0, 1.6, 5.4], fov: 46 }}
          ariaLabel="3D string with a travelling pulse. Amber markers are medium particles; they move only transversally while the pulse profile travels horizontally."
          fallback={
            <WaveCanvas2D
              clock={handle.clock}
              redrawKey={params}
              options={{
                yAt,
                xMin: X_MIN,
                xMax: X_MAX,
                yMax: Math.max(A, 0.05),
                color: COLORS.cyan,
                height: 170,
                label: '2D pulse profile (same model)',
                annotate: (ctx, toPx) => {
                  if (!showParticles) return;
                  ctx.fillStyle = COLORS.amber;
                  for (let i = 0; i < 16; i++) {
                    const x = X_MIN + ((X_MAX - X_MIN) * (i + 0.5)) / 16;
                    const [px, py] = toPx(x, yAt(x, handle.clock.getTime()));
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
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
            xMin={X_MIN}
            xMax={X_MAX}
            amplitude={A}
            color="#22d3ee"
            particleXs={particleXs}
            controlsRef={controlsRef}
            label="pulse travels → medium particles only move up/down"
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={traverseTime} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                peak at x = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(PULSE_START + dir * v * t)} m`} />
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
          <Chart2D title="Spatial snapshot y(x) — redraws at the current time" xLabel="x (m)" yLabel="y (m)" ySymmetric series={snapshotSeries} clock={handle.clock} redrawKey={params} xDomain={[X_MIN, X_MAX]} marker={{ x: () => probeX, label: 'probe', color: COLORS.amber }} precision={2} ariaSummary="Gaussian pulse profile versus position at the current simulation time." />
          <Chart2D title={`Time history at the probe x = ${formatValue(probeX)} m`} xLabel="t (s)" yLabel="y (m)" ySymmetric series={probeHistory} redrawKey={params} xDomain={[0, traverseTime]} marker={{ x: () => handle.clock.getTime(), label: 'now' }} precision={2} ariaSummary="Displacement versus time of the single medium particle at the probe position: a single bump that returns to zero." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Pulse height" symbol="A" unit="m" value={A} min={0.02} max={0.3} step={0.005} precision={3} onChange={(val) => setParam('A', val)} />
          <ParamSlider label="Propagation speed" symbol="v" unit="m/s" value={v} min={0.2} max={5} step={0.05} onChange={(val) => setParam('v', val)} />
          <ParamSlider label="Pulse width" symbol="σ" unit="m" value={sigma} min={0.15} max={1.2} step={0.01} onChange={(val) => setParam('sigma', val)} />
          <ParamSlider label="Tracked particle position" symbol="x_probe" unit="m" value={probeX} min={X_MIN} max={X_MAX} step={0.05} onChange={(val) => setParam('probeX', val)} />
          <div className="field">
            <span className="field-label">Propagation direction</span>
            <div className="segmented" role="group" aria-label="Propagation direction">
              <button type="button" aria-pressed={dir === 1} onClick={() => setParam('direction', 1)}>+x (right)</button>
              <button type="button" aria-pressed={dir === -1} onClick={() => setParam('direction', -1)}>−x (left)</button>
            </div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={showParticles} onChange={(e) => setParam('showParticles', e.target.checked)} />
            Show medium-particle markers
          </label>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> A single disturbance (a flick) travelling along a string.
            This is the mechanical wave idea before sinusoids: <i>the profile moves at v, the
            medium does not</i>.
          </p>
          <p>
            <b>Assumptions.</b> Ideal string: uniform, lossless, non-dispersive — so the pulse keeps
            its exact shape (y is a function of x − vt alone). Real strings disperse sharp pulses
            slightly; that refinement is outside the ideal model and is not simulated here.
          </p>
          <p>
            <b>Observe.</b> The amber markers only bob vertically; each returns to y = 0 after the
            pulse passes (see the probe’s time-history graph). Pause anywhere and read several
            particles’ displacements from the snapshot graph.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      investigations={<GuidedPanel experiments={GUIDED} onLoad={(s) => { applyParams(s); handle.reset(); }} />}
      practice={
        <PracticePanel
          moduleId="wave-motion"
          generate={() => generateQuestion('wave-motion')}
          onLoadToSim={(sp, target) => { if (!target || target === 'pulse') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="wave-motion" tabId="pulse" params={params} defaultName="Pulse propagation" />}
    />
  );
}
