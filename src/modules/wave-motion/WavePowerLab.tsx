import { useCallback, useEffect, useMemo, useState } from 'react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { SaveBar } from '../../components/sim/SaveBar';
import { ParamSlider } from '../../components/controls/ParamSlider';
import { PlaybackToolbar } from '../../components/controls/PlaybackToolbar';
import { PresetBar } from '../../components/controls/PresetBar';
import type { Preset } from '../../components/controls/PresetBar';
import { Chart2D } from '../../components/charts/Chart2D';
import type { ChartSeriesData } from '../../components/charts/Chart2D';
import { COLORS } from '../../components/theme';
import { WaveCanvas2D } from '../../components/sim/WaveCanvas2D';
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
} from '../../physics/waves/travelling';
import { averageWavePower, stringWaveSpeed } from '../../physics/waves/string';
import { exportCsv } from '../../components/sim/SaveBar';
import { formatValue } from '../../utils/format';

interface PowerParams {
  mu: number;
  tension: number;
  freq: number;
  A: number;
}

const DEFAULTS: PowerParams = { mu: 0.02, tension: 80, freq: 2, A: 0.05 };
const RANGES = {
  mu: { min: 0.002, max: 0.2 },
  tension: { min: 5, max: 400 },
  freq: { min: 0.1, max: 10 },
  A: { min: 0.005, max: 0.15 },
};

const PRESETS: Preset<PowerParams>[] = [
  { id: 'setup1', label: 'Setup 1 (baseline)', params: { ...DEFAULTS } },
  { id: 'setup2', label: 'Setup 2 (A doubled)', params: { ...DEFAULTS, A: 0.1 } },
  { id: 'setup3', label: 'Setup 3 (f doubled)', params: { ...DEFAULTS, freq: 4 } },
  { id: 'setup4', label: 'Setup 4 (Tₛ ×4)', params: { ...DEFAULTS, tension: 320 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Power vs amplitude (everything else fixed)',
    objective: 'Verify P ∝ A².',
    setupLabel: 'Baseline setup.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Doubling A changes P by what factor?',
    procedure: [
      'Capture the “before” reference.',
      'Double A; read the new P and the ratio.',
      'Compare with the P-vs-A graph (parabola through both points).',
    ],
    observe: 'P ratio for A → 2A.',
    conclusionPrompt: 'Why is the dependence quadratic? (K = ½mv² and v_max = Aω.)',
  },
  {
    id: 'g2',
    title: 'Power vs frequency',
    objective: 'Verify P ∝ f² at fixed A, μ, Tₛ.',
    setupLabel: 'Baseline setup.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'Which grows faster with frequency: particle speed or power?',
    procedure: ['Capture “before”.', 'Double f; note P ×4 on the readout and on the P-vs-f graph.'],
    observe: 'P(f) curve and measured ratio.',
    conclusionPrompt: 'Explain the ω² factor from P = ½μω²A²v.',
  },
  {
    id: 'g3',
    title: 'Tension enters twice — carefully',
    objective: 'Understand P vs Tₛ with μ, f, A fixed (v = √(Tₛ/μ) also changes).',
    setupLabel: 'Baseline setup.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'P = ½μω²A²v and v = √(Tₛ/μ): is P linear in Tₛ?',
    procedure: [
      'Capture “before”.',
      'Quadruple Tₛ; observe P and v.',
      'Check the P-vs-Tₛ graph: P ∝ √Tₛ when μ, f, A are the fixed variables.',
    ],
    observe: 'P and v before/after; the graph’s stated fixed-variable assumption.',
    conclusionPrompt: 'State precisely which variables were held fixed and why the comparison is only meaningful with that statement.',
  },
];

/** §16.4 — Rate of energy transfer by sinusoidal waves on strings. */
export default function WavePowerLab() {
  const { params, setParam, applyParams } = useLabParams<PowerParams>(
    'wave-motion',
    'power',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const { mu, tension, freq, A } = params;

  const derived = useMemo(() => {
    const v = stringWaveSpeed(tension, mu);
    const omega = angularFrequency(freq);
    const P = averageWavePower({ linearDensity: mu, angularFrequency: omega, amplitude: A, speed: v });
    return { v, omega, P, T: 1 / freq, lambda: v / freq };
  }, [mu, tension, freq, A]);

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

  // Comparison curves — each varies ONE variable, others fixed (labeled).
  const curve = useCallback(
    (vary: 'A' | 'freq' | 'tension', lo: number, hi: number, name: string, color: string): ChartSeriesData => {
      const N = 200;
      const data = new Float64Array(2 * N);
      for (let i = 0; i < N; i++) {
        const val = lo + ((hi - lo) * i) / (N - 1);
        const p = {
          mu,
          tension: vary === 'tension' ? Math.max(val, 1e-3) : tension,
          freq: vary === 'freq' ? Math.max(val, 1e-3) : freq,
          A: vary === 'A' ? val : A,
        };
        const v = stringWaveSpeed(p.tension, p.mu);
        data[2 * i] = val;
        data[2 * i + 1] = averageWavePower({
          linearDensity: p.mu,
          angularFrequency: angularFrequency(p.freq),
          amplitude: p.A,
          speed: v,
        });
      }
      return { name, color, data };
    },
    [mu, tension, freq, A],
  );

  const pASeries = useCallback(
    () => [curve('A', RANGES.A.min, RANGES.A.max, `P vs A (μ, Tₛ, f fixed = ${formatValue(mu)}, ${formatValue(tension)} N, ${formatValue(freq)} Hz)`, COLORS.cyan)],
    [curve, mu, tension, freq],
  );
  const pfSeries = useCallback(
    () => [curve('freq', RANGES.freq.min, RANGES.freq.max, `P vs f (μ, Tₛ, A fixed = ${formatValue(mu)}, ${formatValue(tension)} N, ${formatValue(A)} m)`, COLORS.violet)],
    [curve, mu, tension, A],
  );
  const ptSeries = useCallback(
    () => [curve('tension', RANGES.tension.min, RANGES.tension.max, `P vs Tₛ (μ, f, A fixed — v also changes!)`, COLORS.amber)],
    [curve],
  );

  const [captured, setCaptured] = useState<{ P: number; label: string } | null>(null);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'Wave speed v', value: formatValue(derived.v), unit: 'm/s' },
      { label: 'ω = 2πf', value: formatValue(derived.omega), unit: 'rad/s' },
      { label: 'λ = v/f', value: formatValue(derived.lambda), unit: 'm' },
      { label: 'Avg power P', value: formatValue(derived.P), unit: 'W', tone: 'amber' },
      { label: 'Energy per period P·T', value: formatValue(derived.P * derived.T), unit: 'J' },
      {
        label: captured ? 'Ratio P/P_before' : 'Capture “before” to compare',
        value: captured ? formatValue(derived.P / Math.max(captured.P, 1e-12), 3) : '—',
        tone: captured ? 'green' : undefined,
      },
    ],
    [derived, captured],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'wave-power',
        tex: '\\mathcal{P}_{avg} = \\tfrac12\\,\\mu\\,\\omega^2 A^2 v',
        caption: 'Time-averaged rate of energy transfer of an ideal sinusoidal wave on an ideal string.',
        variables: [
          { sym: '\\mu', name: 'linear mass density', unit: `kg/m (now ${formatValue(mu)})` },
          { sym: '\\omega', name: 'angular frequency', unit: `rad/s (now ${formatValue(derived.omega)})` },
          { sym: 'A', name: 'transverse amplitude', unit: `m (now ${formatValue(A)})` },
          { sym: 'v', name: 'wave speed √(Tₛ/μ)', unit: `m/s (now ${formatValue(derived.v)})` },
        ],
        substitutedTex: `\\mathcal{P}_{avg} = 0.5 \\cdot ${formatValue(mu)} \\cdot (${formatValue(derived.omega)})^2 \\cdot (${formatValue(A)})^2 \\cdot ${formatValue(derived.v)} = ${formatValue(derived.P, 4)}\\ \\mathrm{W}`,
      },
    ],
    [mu, A, derived],
  );

  const predictions = useMemo<PredictionScenario<PowerParams>[]>(
    () => [
      {
        id: 'double-A',
        changeLabel: 'Double A',
        promptTex: 'Amplitude is doubled ($A \\to 2A$), everything else fixed. What happens to $\\mathcal{P}_{avg}$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const v = stringWaveSpeed(p.tension, p.mu);
          const w = angularFrequency(p.freq);
          const P1 = averageWavePower({ linearDensity: p.mu, angularFrequency: w, amplitude: p.A, speed: v });
          const A2 = Math.min(RANGES.A.max, p.A * 2);
          const P2 = averageWavePower({ linearDensity: p.mu, angularFrequency: w, amplitude: A2, speed: v });
          return {
            correctOptionId: 'x4',
            explanation: `Computed: $\\mathcal{P}_1 = ${formatValue(P1, 4)}\\ \\mathrm{W}$, $\\mathcal{P}_2 = ${formatValue(P2, 4)}\\ \\mathrm{W}$ — ratio ${formatValue(P2 / Math.max(P1, 1e-12), 2)} (= 4 exactly when A is not clamped by the range). $\\mathcal{P} \\propto A^2$.`,
            applyTo: (q) => ({ ...q, A: A2 }),
          };
        },
      },
      {
        id: 'double-f',
        changeLabel: 'Double f',
        promptTex: 'Frequency is doubled with $\\mu, T_s, A$ fixed. What happens to $\\mathcal{P}_{avg}$? (Note: $v$ is unchanged.)',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const v = stringWaveSpeed(p.tension, p.mu);
          const P1 = averageWavePower({ linearDensity: p.mu, angularFrequency: angularFrequency(p.freq), amplitude: p.A, speed: v });
          const f2 = Math.min(RANGES.freq.max, p.freq * 2);
          const P2 = averageWavePower({ linearDensity: p.mu, angularFrequency: angularFrequency(f2), amplitude: p.A, speed: v });
          return {
            correctOptionId: 'x4',
            explanation: `Computed: $\\mathcal{P}_1 = ${formatValue(P1, 4)}\\ \\mathrm{W}$, $\\mathcal{P}_2 = ${formatValue(P2, 4)}\\ \\mathrm{W}$ — ratio ${formatValue(P2 / Math.max(P1, 1e-12), 2)}. $\\omega = 2\\pi f$ enters squared, and $v = \\sqrt{T_s/\\mu}$ does not involve $f$.`,
            applyTo: (q) => ({ ...q, freq: f2 }),
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
          <div className="panel-title">Energy-transfer view — wave profile with live power</div>
          <WaveCanvas2D
            clock={handle.clock}
            redrawKey={params}
            options={{
              yAt,
              xMin: 0,
              xMax: Math.min(6, Math.max(2 * derived.lambda, 1)),
              yMax: A,
              color: COLORS.amber,
              height: 190,
              label: 'Sinusoidal wave transporting energy at P_avg = ½ μ ω² A² v',
              annotate: (ctx, toPx) => {
                // Energy-flow arrow riding with the wave.
                const t = handle.clock.getTime();
                const xHead = ((derived.v * t) % 6) + 0.4;
                const [px, py] = toPx(Math.min(xHead, 5.6), 0);
                ctx.strokeStyle = COLORS.red;
                ctx.fillStyle = COLORS.red;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px - 26, py - 26);
                ctx.lineTo(px, py - 26);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(px, py - 26);
                ctx.lineTo(px - 7, py - 30);
                ctx.lineTo(px - 7, py - 22);
                ctx.closePath();
                ctx.fill();
                ctx.font = "10px Consolas, monospace";
                ctx.fillText(`P = ${formatValue(derived.P, 3)} W →`, px - 26, py - 34);
              },
            }}
          />
          <p className="prose" style={{ fontSize: '0.8rem' }}>
            The red arrow indicates the direction of energy transport (with the wave). Its quoted
            power is <b>P_avg = ½μω²A²v</b>, computed live from the current parameters — the
            time-average over one period of the instantaneous power F·v_y at any point.
          </p>
        </div>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={3 * derived.T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={(p) => { applyParams(p.params); handle.reset(); }} />
            <span className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  setCaptured({
                    P: derived.P,
                    label: `μ=${formatValue(mu)}, Tₛ=${formatValue(tension)} N, f=${formatValue(freq)} Hz, A=${formatValue(A)} m`,
                  })
                }
                title="Remember the current power as the BEFORE value of a comparison"
              >
                Capture “before” P
              </button>
              {captured && (
                <button type="button" className="btn ghost sm" onClick={() => setCaptured(null)}>
                  Clear
                </button>
              )}
            </span>
          </div>
          {captured && (
            <div className="callout" style={{ margin: 0 }}>
              <b>Comparison (computed from the model).</b> Before: P = {formatValue(captured.P, 4)} W
              at [{captured.label}]. Now: P = {formatValue(derived.P, 4)} W. Ratio P/P₀ ={' '}
              <b>{formatValue(derived.P / Math.max(captured.P, 1e-12), 3)}</b>. Use presets “Setup
              1/2” for the classic single-variable comparisons — each preset changes exactly one
              quantity so the ratio is attributable.
            </div>
          )}
        </>
      }
      measurements={<Measurements items={measurements} clock={handle.clock} />}
      charts={
        <div className="charts-row">
          <Chart2D title="P vs amplitude A" xLabel="A (m)" yLabel="P (W)" series={pASeries} redrawKey={params} marker={{ x: () => A, label: 'current' }} precision={3} ariaSummary="Parabola: average power grows with the square of amplitude." />
          <Chart2D title="P vs frequency f" xLabel="f (Hz)" yLabel="P (W)" series={pfSeries} redrawKey={params} marker={{ x: () => freq, label: 'current' }} precision={3} ariaSummary="Parabola: average power grows with the square of frequency." />
          <Chart2D title="P vs tension Tₛ (μ, f, A fixed; v varies)" xLabel="Tₛ (N)" yLabel="P (W)" series={ptSeries} redrawKey={params} marker={{ x: () => tension, label: 'current' }} precision={3} ariaSummary="Square-root growth of power with tension because the wave speed enters linearly and itself grows as the square root of tension." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Linear mass density" symbol="μ" unit="kg/m" value={mu} min={0.002} max={0.2} step={0.001} precision={3} onChange={(v) => setParam('mu', v)} />
          <ParamSlider label="String tension" symbol="Tₛ" unit="N" value={tension} min={5} max={400} step={1} precision={1} onChange={(v) => setParam('tension', v)} />
          <ParamSlider label="Driving frequency" symbol="f" unit="Hz" value={freq} min={0.1} max={10} step={0.05} onChange={(v) => setParam('freq', v)} />
          <ParamSlider label="Amplitude" symbol="A" unit="m" value={A} min={0.005} max={0.15} step={0.001} precision={3} onChange={(v) => setParam('A', v)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> The rate at which a sinusoidal wave carries energy along an
            ideal string (§16.4). Each string element has kinetic energy ½(μΔx)v_y²; summing over a
            wavelength and averaging over a period gives P_avg = ½μω²A²v.
          </p>
          <p>
            <b>Assumptions.</b> Ideal string (uniform μ, perfectly flexible, lossless), sinusoidal
            steady-state wave, small transverse displacements, v = √(Tₛ/μ) from the same medium.
          </p>
          <p>
            <b>Honest comparisons.</b> Each P-curve states which variables are held fixed. The
            P-vs-Tₛ curve is <i>not</i> a controlled A/B on tension alone in a physical sense —
            raising Tₛ also raises v, which is part of why P grows as √Tₛ here.
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
          onLoadToSim={(sp, target) => { if (!target || target === 'power') applyParams(sp); }}
        />
      }
      actions={
        <>
          <SaveBar moduleId="wave-motion" tabId="power" params={params} defaultName="Wave power lab" />
          <button
            type="button"
            className="btn sm ghost"
            title="Export P vs A / f / Tₛ datasets as CSV"
            onClick={() => {
              const rows: (string | number)[][] = [];
              const N = 100;
              for (let i = 0; i <= N; i++) {
                const a = RANGES.A.min + ((RANGES.A.max - RANGES.A.min) * i) / N;
                const f = RANGES.freq.min + ((RANGES.freq.max - RANGES.freq.min) * i) / N;
                const ts = RANGES.tension.min + ((RANGES.tension.max - RANGES.tension.min) * i) / N;
                const vBase = stringWaveSpeed(tension, mu);
                rows.push([
                  a.toFixed(5),
                  averageWavePower({ linearDensity: mu, angularFrequency: derived.omega, amplitude: a, speed: vBase }).toFixed(6),
                  f.toFixed(4),
                  averageWavePower({ linearDensity: mu, angularFrequency: angularFrequency(f), amplitude: A, speed: vBase }).toFixed(6),
                  ts.toFixed(2),
                  averageWavePower({ linearDensity: mu, angularFrequency: derived.omega, amplitude: A, speed: stringWaveSpeed(ts, mu) }).toFixed(6),
                ]);
              }
              exportCsv(
                'wave-power-sweeps.csv',
                ['A_m', 'P_W_vs_A', 'f_Hz', 'P_W_vs_f', 'Ts_N', 'P_W_vs_Ts'],
                rows,
              );
            }}
          >
            CSV (sweeps)
          </button>
        </>
      }
    />
  );
}
