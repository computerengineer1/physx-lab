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
import {
  fixedEndAntinodePositions,
  fixedEndNodePositions,
  fundamentalFrequency,
  harmonicFrequency,
  harmonicWavelength,
  stringWaveSpeed,
} from '../../physics/waves/string';
import {
  harmonicStandingParams,
  standingWaveDisplacement,
  standingWaveEnvelope,
} from '../../physics/interference/standing';
import { formatValue } from '../../utils/format';
import { Wave3D } from '../../components/three/Wave3D';

interface HarmonicsParams {
  L: number; // string length [m]
  tension: number; // N
  mu: number; // kg/m
  n: number; // harmonic (integer)
  A: number; // component amplitude [m]
}

const DEFAULTS: HarmonicsParams = { L: 2, tension: 80, mu: 0.02, n: 2, A: 0.05 };
const RANGES = {
  L: { min: 0.5, max: 4 },
  tension: { min: 5, max: 400 },
  mu: { min: 0.002, max: 0.2 },
  n: { min: 1, max: 8 },
  A: { min: 0.01, max: 0.12 },
};

const PRESETS: Preset<HarmonicsParams>[] = [
  { id: 'fund', label: 'Fundamental (n = 1)', params: { ...DEFAULTS, n: 1 } },
  { id: 'second', label: '2nd harmonic', params: { ...DEFAULTS, n: 2 } },
  { id: 'third', label: '3rd harmonic', params: { ...DEFAULTS, n: 3 } },
  { id: 'tight', label: 'Tight string (high v)', params: { ...DEFAULTS, tension: 300, mu: 0.005, n: 3 } },
  { id: 'long', label: 'Long string', params: { ...DEFAULTS, L: 4, n: 4 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'Only integer harmonics fit',
    objective: 'See the boundary condition quantize the modes.',
    setupLabel: 'Default string, n = 2.',
    setup: { ...DEFAULTS, n: 2 },
    predictionPrompt: 'How many half-wavelengths fit for n = 2? How many nodes?',
    procedure: [
      'Step through n = 1…5; count loops and nodes each time.',
      'Compare node positions with x = mL/n from the measurements.',
      'Note that both ends never move (fixed boundary).',
    ],
    observe: 'Loop count, node count (n + 1), node positions.',
    conclusionPrompt: 'Why can’t n = 2.5 exist on a string fixed at both ends?',
  },
  {
    id: 'g2',
    title: 'Harmonic frequencies form an integer ladder',
    objective: 'Verify fₙ = n·f₁ = nv/(2L).',
    setupLabel: 'Default string.',
    setup: { ...DEFAULTS },
    predictionPrompt: 'If f₁ = 25 Hz, what are f₂ and f₃?',
    procedure: [
      'Record f₁ (n = 1).',
      'Switch to n = 2, 3, 4 and record each fₙ.',
      'Check the ratios fₙ/f₁ against n.',
    ],
    observe: 'Table of n and fₙ; ratios.',
    conclusionPrompt: 'Write the general rule and explain where v comes from.',
  },
  {
    id: 'g3',
    title: 'Tuning the string: tension, density, length',
    objective: 'Explore which physical knobs change the pitch (f₁).',
    setupLabel: 'n = 1.',
    setup: { n: 1, L: 2, tension: 80, mu: 0.02 },
    predictionPrompt: 'Which single change raises f₁ the most: ×4 tension, ×4 μ, or halving L?',
    procedure: [
      'Capture the baseline f₁.',
      'Try each change separately and record f₁.',
      'Rank the effects and compare with f₁ = √(Tₛ/μ)/(2L).',
    ],
    observe: 'f₁ after each single change.',
    conclusionPrompt: 'Explain each ranking from the formula (square roots vs linear).',
  },
];

/** §18.4 — Analysis model: waves under boundary conditions (string fixed at both ends). */
export default function HarmonicsLab() {
  const { params, setParam, applyParams } = useLabParams<HarmonicsParams>(
    'interference',
    'harmonics',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const { L, tension, mu, A } = params;
  const n = Math.max(1, Math.min(8, Math.round(params.n)));

  const derived = useMemo(() => {
    const v = stringWaveSpeed(tension, mu);
    const lambdaN = harmonicWavelength(L, n);
    const fn = harmonicFrequency(L, v, n);
    const standing = harmonicStandingParams(L, v, n, A);
    return {
      v,
      lambdaN,
      fn,
      f1: fundamentalFrequency(L, v),
      standing,
      nodes: fixedEndNodePositions(L, n),
      antinodes: fixedEndAntinodePositions(L, n),
      T: 1 / fn,
    };
  }, [L, tension, mu, n, A]);

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
    const env = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const x = (L * i) / (N - 1);
      d[2 * i] = env[2 * i] = x;
      d[2 * i + 1] = yAt(x, t);
      env[2 * i + 1] = standingWaveEnvelope(derived.standing, x);
    }
    return [
      { name: `mode ${n} shape at t = ${t.toFixed(2)} s`, color: COLORS.cyan, data: d },
      { name: 'envelope 2A|sin(nπx/L)|', color: COLORS.amber, dash: [7, 4], data: env },
    ];
  }, [handle.clock, yAt, derived.standing, L, n]);

  const ladderSeries = useCallback((): ChartSeriesData[] => {
    const N = 8;
    const d = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      d[2 * i] = i + 1;
      d[2 * i + 1] = harmonicFrequency(L, derived.v, i + 1);
    }
    return [{ name: 'harmonic ladder fₙ = n·f₁', color: COLORS.violet, data: d }];
  }, [L, derived.v]);

  const measurements = useMemo<Measurement[]>(
    () => [
      { label: 'String length L', value: formatValue(L), unit: 'm' },
      { label: 'Wave speed v', value: formatValue(derived.v), unit: 'm/s' },
      { label: 'Harmonic n', value: String(n), tone: 'accent' },
      { label: 'λₙ = 2L/n', value: formatValue(derived.lambdaN), unit: 'm', tone: 'accent' },
      { label: 'fₙ = nv/(2L)', value: formatValue(derived.fn), unit: 'Hz', tone: 'amber' },
      { label: 'Fundamental f₁', value: formatValue(derived.f1), unit: 'Hz' },
      { label: 'fₙ / f₁', value: formatValue(derived.fn / derived.f1, 0), unit: '(= n)' },
      { label: 'Nodes (incl. ends)', value: String(n + 1) },
      { label: 'Antinodes', value: String(n) },
      { label: 'Node positions', value: derived.nodes.map((x) => formatValue(x, 2)).join(', '), unit: 'm' },
    ],
    [L, n, derived],
  );

  const formulas = useMemo<DisplayedFormula[]>(
    () => [
      {
        id: 'harmonics',
        tex: '\\lambda_n = \\frac{2L}{n},\\qquad f_n = \\frac{nv}{2L} = n f_1,\\qquad n = 1, 2, 3, \\dots',
        caption: 'Boundary conditions y(0, t) = y(L, t) = 0 force kL = nπ — only integer harmonics are natural modes of the finite string.',
        variables: [
          { sym: 'L', name: 'string length', unit: `m (now ${formatValue(L)})` },
          { sym: 'v', name: 'wave speed √(Tₛ/μ)', unit: `m/s (now ${formatValue(derived.v)})` },
          { sym: 'n', name: 'harmonic number', unit: `(now ${n})` },
        ],
        substitutedTex: `\\lambda_${n} = ${formatValue(derived.lambdaN, 3)}\\ \\mathrm{m},\\quad f_${n} = ${formatValue(derived.fn, 2)}\\ \\mathrm{Hz}`,
      },
      {
        id: 'standing-wave',
        tex: 'y_n(x,t) = 2A\\sin\\!\\left(\\frac{n\\pi x}{L}\\right)\\cos(\\omega_n t),\\quad \\omega_n = \\frac{n\\pi v}{L}',
        caption: 'The mode shape that satisfies both fixed ends at every instant.',
        substitutedTex: `y_${n}(x,t) = ${formatValue(2 * A)}\\sin\\!\\left(${formatValue((n * Math.PI) / L, 3)}\\,x\\right)\\cos(${formatValue(derived.standing.angularFrequency, 2)}\\,t)`,
      },
      {
        id: 'string-v',
        tex: 'v = \\sqrt{T_s/\\mu}',
        substitutedTex: `v = \\sqrt{${formatValue(tension)}/${formatValue(mu)}} = ${formatValue(derived.v, 3)}\\ \\mathrm{m/s}`,
      },
    ],
    [L, n, A, derived, tension, mu],
  );

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [0, 1.5, 4.6], fov: 46 }}
          ariaLabel={`3D string of length ${formatValue(L)} m fixed at both ends vibrating in harmonic ${n}: ${n} loops, ${n + 1} nodes.`}
          fallback={
            <WaveCanvas2D
              clock={handle.clock}
              redrawKey={params}
              options={{
                yAt,
                xMin: 0,
                xMax: L,
                yMax: 2 * A,
                color: COLORS.cyan,
                height: 180,
                label: '2D mode shape (same model)',
                annotate: (ctx, toPx) => {
                  ctx.fillStyle = COLORS.red;
                  for (const nx of derived.nodes) {
                    const [px, py] = toPx(nx, 0);
                    ctx.beginPath();
                    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                  }
                  ctx.fillStyle = COLORS.green;
                  for (const ax of derived.antinodes) {
                    const [px, py] = toPx(ax, 0);
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
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
            xMax={L}
            amplitude={2 * A}
            color="#22d3ee"
            particleXs={derived.antinodes.slice(0, 8)}
            controlsRef={controlsRef}
            label={`mode n = ${n}: ${n} loop${n > 1 ? 's' : ''}, ${n + 1} nodes, ${n} antinodes (amber markers)`}
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
                f_{n} = <LiveValue clock={handle.clock} compute={() => `${formatValue(derived.fn)} Hz`} />
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
          <Chart2D title={`Mode ${n} shape and envelope`} xLabel="x (m)" yLabel="y (m)" ySymmetric series={profileSeries} clock={handle.clock} redrawKey={params} xDomain={[0, L]} precision={3} ariaSummary={`Standing-wave mode ${n}: ${n} loops pinned at both fixed ends, oscillating inside the envelope.`} />
          <Chart2D title="Allowed frequencies fₙ = n·v/(2L)" xLabel="n" yLabel="fₙ (Hz)" series={ladderSeries} redrawKey={params} marker={{ x: () => n, label: `n=${n}`, color: COLORS.amber }} precision={1} ariaSummary="Straight ladder of harmonic frequencies, integer multiples of the fundamental." />
        </div>
      }
      controls={
        <>
          <ParamSlider label="String length" symbol="L" unit="m" value={L} min={0.5} max={4} step={0.05} onChange={(v) => setParam('L', v)} />
          <ParamSlider label="Tension" symbol="Tₛ" unit="N" value={tension} min={5} max={400} step={1} precision={1} onChange={(v) => setParam('tension', v)} />
          <ParamSlider label="Linear density" symbol="μ" unit="kg/m" value={mu} min={0.002} max={0.2} step={0.001} precision={3} onChange={(v) => setParam('mu', v)} />
          <ParamSlider label="Harmonic number" symbol="n" unit="(integer)" value={n} min={1} max={8} step={1} precision={0} onChange={(v) => setParam('n', Math.round(v))} tooltip="Only positive integers are valid natural modes; the slider snaps to integers" />
          <ParamSlider label="Component amplitude" symbol="A" unit="m" value={A} min={0.01} max={0.12} step={0.005} precision={3} onChange={(v) => setParam('A', v)} />
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> A finite string <i>fixed at both ends</i> — the boundary
            condition implemented by this lab. Requiring y = 0 at x = 0 and x = L admits only
            wavelengths λₙ = 2L/n, so the natural frequencies form the integer ladder
            fₙ = nv/(2L).
          </p>
          <p>
            <b>Honest scope.</b> Only the fixed–fixed boundary condition is modeled here (the
            syllabus case for §18.4). Other boundary conditions (free ends, mixed) are not
            simulated and are not claimed as valid natural modes anywhere in this lab. n is
            restricted to positive integers — no invalid “half modes” can be displayed.
          </p>
          <p>
            <b>Assumptions.</b> Ideal uniform string, small transverse vibrations, v = √(Tₛ/μ)
            independent of frequency, perfectly rigid supports.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      investigations={<GuidedPanel experiments={GUIDED} onLoad={(s) => { applyParams(s); handle.reset(); }} />}
      practice={
        <PracticePanel
          moduleId="interference"
          generate={() => generateQuestion('interference')}
          onLoadToSim={(sp, target) => { if (!target || target === 'harmonics') applyParams(sp); }}
        />
      }
      actions={<SaveBar moduleId="interference" tabId="harmonics" params={params} defaultName="String harmonics" />}
    />
  );
}
