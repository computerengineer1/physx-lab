import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Camera } from 'lucide-react';
import { LabLayout } from '../../components/sim/LabLayout';
import { Measurements } from '../../components/sim/Measurements';
import type { Measurement } from '../../components/sim/Measurements';
import { FormulaPanel } from '../../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../../components/sim/FormulaPanel';
import { Scene3D } from '../../components/sim/Scene3D';
import { LiveValue } from '../../components/sim/LiveValue';
import { SaveBar, exportCsv } from '../../components/sim/SaveBar';
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
  calculateSpringState,
  shmAngularFrequency,
  shmFrequency,
  shmPeriod,
  solutionFromInitialConditions,
  springForce,
} from '../../physics/shm/shm';
import { totalOscillatorEnergy } from '../../physics/shm/energy';
import { formatValue } from '../../utils/format';
import { SpringMassScene } from './scenes/SpringMassScene';
import { SpringFallbackSvg } from './scenes/SpringFallbackSvg';

interface SpringParams {
  m: number; // kg
  k: number; // N/m
  x0: number; // m
  v0: number; // m/s
  showVectors: boolean;
  showForce: boolean;
  showRuler: boolean;
}

const DEFAULTS: SpringParams = {
  m: 0.5,
  k: 20,
  x0: 0.25,
  v0: 0,
  showVectors: true,
  showForce: false,
  showRuler: true,
};

const RANGES = {
  m: { min: 0.1, max: 5 },
  k: { min: 1, max: 200 },
  x0: { min: -0.5, max: 0.5 },
  v0: { min: -3, max: 3 },
};

const PRESETS: Preset<SpringParams>[] = [
  { id: 'soft', label: 'Soft spring (low k)', params: { ...DEFAULTS, m: 1, k: 5, x0: 0.3, v0: 0 } },
  { id: 'medium', label: 'Medium', params: { ...DEFAULTS } },
  { id: 'stiff', label: 'Stiff spring (high k)', params: { ...DEFAULTS, m: 0.3, k: 120, x0: 0.15, v0: 0 } },
  { id: 'heavy', label: 'Heavy mass', params: { ...DEFAULTS, m: 4, k: 40, x0: 0.2, v0: 0 } },
  { id: 'kick', label: 'Pushed from equilibrium', params: { ...DEFAULTS, m: 0.5, k: 20, x0: 0, v0: 1.5 } },
];

const GUIDED: GuidedExperiment[] = [
  {
    id: 'g1',
    title: 'How does the period depend on mass? (k fixed)',
    objective: 'Discover the T ∝ √m relationship experimentally.',
    setupLabel: 'k = 40 N/m, m = 0.5 kg, released from rest at x₀ = 0.20 m.',
    setup: { k: 40, m: 0.5, x0: 0.2, v0: 0 },
    predictionPrompt:
      'Before measuring: if you quadruple the mass (0.5 → 2.0 kg), does the period become 2×, 4×, or √2× larger?',
    procedure: [
      'Load the setup and press Play. Read the period T from the measurements panel.',
      'Set m = 1.0 kg. Record the new T.',
      'Set m = 2.0 kg, then m = 4.0 kg (or 8× the original by choosing 4.0 kg). Record each T.',
      'Compute T(2m)/T(m) for each doubling and compare with √2 ≈ 1.414.',
    ],
    observe: 'A table of m and T; the ratio of periods for each mass doubling.',
    conclusionPrompt:
      'State the relationship between T and m. Does it match T = 2π√(m/k)? Which quantity did NOT change the period?',
  },
  {
    id: 'g2',
    title: 'Does amplitude change the period?',
    objective: 'Test the amplitude-independence of ideal SHM.',
    setupLabel: 'k = 30 N/m, m = 1.0 kg, released from rest.',
    setup: { k: 30, m: 1, x0: 0.1, v0: 0 },
    predictionPrompt: 'If x₀ is doubled from 0.10 m to 0.40 m, does the period change?',
    procedure: [
      'Load the setup. Note T and the total energy E = ½kA².',
      'Increase x₀ in steps to 0.40 m while keeping v₀ = 0.',
      'Watch T and E after each change.',
    ],
    observe: 'T stays constant while E grows as A².',
    conclusionPrompt:
      'Explain why the period is amplitude-independent for an ideal spring (F ∝ x) while the energy is not.',
  },
  {
    id: 'g3',
    title: 'Velocity and acceleration at key points',
    objective: 'Connect the phase of the motion to v and a.',
    setupLabel: 'Default setup with velocity/acceleration arrows visible.',
    setup: { m: 0.5, k: 20, x0: 0.25, v0: 0, showVectors: true },
    predictionPrompt: 'At the turning point, which is zero — velocity or acceleration? At equilibrium?',
    procedure: [
      'Press Play, then use single-step or pause near a turning point (|x| maximal).',
      'Compare the lengths of the v (cyan) and a (amber) arrows there.',
      'Repeat at the equilibrium crossing (x = 0).',
      'Use the x(t) graph: click on it to seek the simulation to that time.',
    ],
    observe: 'Arrow lengths and readouts of v and a at turning points vs equilibrium.',
    conclusionPrompt: 'Complete: “v is maximal where ___ is zero, and a is maximal where ___ is maximal.”',
  },
];

/** §15.1 — Motion of an object attached to a spring. */
export default function SpringMassLab() {
  const { params, setParam, applyParams } = useLabParams<SpringParams>(
    'oscillatory-motion',
    'spring',
    DEFAULTS,
    RANGES,
  );
  const handle = useSimClock();
  const controlsRef = useRef<{ reset: () => void } | null>(null);

  const { m, k, x0, v0 } = params;

  const derived = useMemo(() => {
    const omega = shmAngularFrequency({ k, m });
    const T = shmPeriod({ k, m });
    const f = shmFrequency({ k, m });
    const { amplitude, phase } = solutionFromInitialConditions(x0, v0, omega);
    const E = totalOscillatorEnergy(k, amplitude);
    return { omega, T, f, amplitude, phase, E };
  }, [m, k, x0, v0]);

  // Any parameter edit while paused must still refresh every subscribed view.
  useEffect(() => {
    handle.clock.bump();
  }, [params, handle.clock]);

  const getState = useCallback(
    (t: number) => {
      const s = calculateSpringState({ k, m }, x0, v0, t);
      return { x: s.x, v: s.v, a: s.a, F: springForce(k, s.x) };
    },
    [k, m, x0, v0],
  );

  const xSeries = useCallback((): ChartSeriesData[] => {
    const T = derived.T;
    const N = 480;
    const tEnd = 4 * T;
    const data = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      data[2 * i] = t;
      data[2 * i + 1] = getState(t).x;
    }
    return [
      {
        name: 'x(t) = A cos(ωt + φ)',
        color: COLORS.cyan,
        data,
      },
    ];
  }, [derived.T, getState]);

  const measurements = useMemo<Measurement[]>(() => {
    const { omega, T, f, amplitude, phase } = derived;
    return [
      { label: 'Angular freq ω', value: formatValue(omega), unit: 'rad/s' },
      { label: 'Period T', value: formatValue(T), unit: 's', tone: 'accent' },
      { label: 'Frequency f', value: formatValue(f), unit: 'Hz' },
      { label: 'Amplitude A', value: formatValue(amplitude), unit: 'm', tone: 'violet' },
      { label: 'Phase φ', value: formatValue(phase), unit: 'rad' },
      { label: 'Total energy E', value: formatValue(derived.E), unit: 'J', tone: 'amber' },
      {
        label: 'Displacement x',
        unit: 'm',
        live: (t) => formatValue(getState(t).x),
        tone: 'accent',
      },
      { label: 'Velocity v', unit: 'm/s', live: (t) => formatValue(getState(t).v) },
      { label: 'Acceleration a', unit: 'm/s²', live: (t) => formatValue(getState(t).a) },
      { label: 'Spring force F', unit: 'N', live: (t) => formatValue(getState(t).F), tone: 'red' },
    ];
  }, [derived, getState]);

  const formulas = useMemo<DisplayedFormula[]>(() => {
    const { omega, T, amplitude, phase } = derived;
    return [
      {
        id: 'hooke',
        tex: 'F_s = -kx',
        caption: 'Hooke’s law — the restoring force of an ideal spring.',
        variables: [
          { sym: 'k', name: 'spring constant', unit: `N/m (now ${formatValue(k)})` },
          { sym: 'x', name: 'displacement from equilibrium', unit: 'm' },
        ],
        substitutedTex: `F_s = -(${formatValue(k)})\\,x \\;\\Rightarrow\\; F_s(t=\\text{now}) = ${formatValue(getState(handle.clock.getTime()).F, 2)}\\ \\mathrm{N}`,
      },
      {
        id: 'shm-omega',
        tex: '\\omega = \\sqrt{k/m}',
        variables: [
          { sym: 'm', name: 'mass', unit: `kg (now ${formatValue(m)})` },
        ],
        substitutedTex: `\\omega = \\sqrt{${formatValue(k)}/${formatValue(m)}} = ${formatValue(omega, 4)}\\ \\mathrm{rad/s}`,
      },
      {
        id: 'shm-period',
        tex: 'T = 2\\pi\\sqrt{m/k},\\quad f = 1/T',
        substitutedTex: `T = 2\\pi\\sqrt{${formatValue(m)}/${formatValue(k)}} = ${formatValue(T, 4)}\\ \\mathrm{s},\\quad f = ${formatValue(derived.f, 4)}\\ \\mathrm{Hz}`,
      },
      {
        id: 'shm-x',
        tex: 'x(t) = A\\cos(\\omega t + \\varphi)',
        caption: 'A and φ are derived from your initial conditions x₀, v₀ — they are never set independently in this mode.',
        substitutedTex: `x(t) = ${formatValue(amplitude)}\\cos(${formatValue(omega, 3)}\\,t ${phase >= 0 ? '+' : '−'} ${formatValue(Math.abs(phase))})`,
      },
      {
        id: 'shm-ic',
        tex: 'A = \\sqrt{x_0^2 + (v_0/\\omega)^2},\\quad \\varphi = \\operatorname{atan2}(-v_0/\\omega,\\, x_0)',
        substitutedTex: `A = \\sqrt{(${formatValue(x0)})^2 + (${formatValue(v0)}/${formatValue(omega, 3)})^2} = ${formatValue(amplitude)}\\ \\mathrm{m}`,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, k, m, x0, v0]);

  const predictions = useMemo<PredictionScenario<SpringParams>[]>(
    () => [
      {
        id: 'double-m',
        changeLabel: 'Double the mass m',
        promptTex:
          'The mass is doubled ($m \\to 2m$) while $k$ stays fixed. What happens to the oscillation **period** $T = 2\\pi\\sqrt{m/k}$?',
        options: [
          { id: 'inc', label: 'It increases (by √2 ≈ 1.41×)' },
          { id: 'dec', label: 'It decreases' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const T1 = shmPeriod({ k: p.k, m: p.m });
          const m2 = Math.min(RANGES.m.max, p.m * 2);
          const T2 = shmPeriod({ k: p.k, m: m2 });
          return {
            correctOptionId: 'inc',
            explanation: `Computed from the model: $T_1 = ${formatValue(T1, 4)}\\ \\mathrm{s}$ and $T_2 = ${formatValue(T2, 4)}\\ \\mathrm{s}$ — the ratio is $\\sqrt{2} \\approx 1.414$ (exactly $\\sqrt{2m/k}\\,/\\sqrt{m/k}$). Heavier mass ⇒ slower oscillation.`,
            applyTo: (q) => ({ ...q, m: m2 }),
          };
        },
      },
      {
        id: 'double-k',
        changeLabel: 'Double the stiffness k',
        promptTex:
          'The spring constant is doubled ($k \\to 2k$) with $m$ fixed. What happens to the **period**?',
        options: [
          { id: 'inc', label: 'It increases' },
          { id: 'dec', label: 'It decreases (÷√2 ≈ 0.71×)' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const T1 = shmPeriod({ k: p.k, m: p.m });
          const k2 = Math.min(RANGES.k.max, p.k * 2);
          const T2 = shmPeriod({ k: k2, m: p.m });
          return {
            correctOptionId: 'dec',
            explanation: `Model check: $T_1 = ${formatValue(T1, 4)}\\ \\mathrm{s}$, $T_2 = ${formatValue(T2, 4)}\\ \\mathrm{s}$. A stiffer spring restores faster ⇒ shorter period ($T \\propto 1/\\sqrt{k}$).`,
            applyTo: (q) => ({ ...q, k: k2 }),
          };
        },
      },
      {
        id: 'double-A',
        changeLabel: 'Double the amplitude',
        promptTex:
          'The oscillator is released from rest at $2x_0$ instead of $x_0$ (with $v_0 = 0$). What happens to the **total energy** $E = \\tfrac12 kA^2$?',
        options: [
          { id: 'x2', label: 'It doubles' },
          { id: 'x4', label: 'It quadruples' },
          { id: 'same', label: 'It stays the same' },
        ],
        evaluate: (p) => {
          const w = shmAngularFrequency({ k: p.k, m: p.m });
          const A1 = solutionFromInitialConditions(p.x0, 0, w).amplitude;
          const x2 = Math.max(-RANGES.x0.max, Math.min(RANGES.x0.max, p.x0 * 2));
          const A2 = solutionFromInitialConditions(x2 === 0 ? 0.05 : x2, 0, w).amplitude;
          const E1 = totalOscillatorEnergy(p.k, A1);
          const E2 = totalOscillatorEnergy(p.k, A2);
          const factor = E1 > 0 ? E2 / E1 : Infinity;
          return {
            correctOptionId: 'x4',
            explanation: `Model check: $E_1 = \\tfrac12 kA_1^2 = ${formatValue(E1, 4)}\\ \\mathrm{J}$, $E_2 = ${formatValue(E2, 4)}\\ \\mathrm{J}$ — a factor of ${Number.isFinite(factor) ? formatValue(factor, 2) : '∞ (the first case had zero amplitude)'}. Since $E \\propto A^2$, doubling $A$ quadruples $E$. The period does **not** change.`,
            applyTo: (q) => ({ ...q, x0: x2 === 0 ? 0.05 : x2, v0: 0 }),
          };
        },
      },
    ],
    [],
  );

  const onPreset = (p: Preset<SpringParams>) => {
    applyParams(p.params);
    handle.reset();
  };

  return (
    <LabLayout
      scene={
        <Scene3D
          camera={{ position: [1.9, 0.6, 3.4], fov: 45 }}
          ariaLabel="3D spring–mass oscillator. The mass hangs from a helical spring and oscillates vertically about the equilibrium line according to x(t) = A cos(ωt + φ). Numeric equivalents appear in the measurements panel."
          fallback={<SpringFallbackSvg getState={getState} clock={handle.clock} />}
        >
          <SpringMassScene
            clock={handle.clock}
            getState={getState}
            showVectors={params.showVectors}
            showForce={params.showForce}
            showRuler={params.showRuler}
            controlsRef={controlsRef}
          />
        </Scene3D>
      }
      toolbar={
        <>
          <PlaybackToolbar handle={handle} scrubMax={4 * derived.T} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <PresetBar presets={PRESETS} onApply={onPreset} />
            <span className="row" style={{ gap: 6 }}>
              <span className="scene-chip">
                x = <LiveValue clock={handle.clock} compute={(t) => `${formatValue(getState(t).x)} m`} />
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => controlsRef.current?.reset()}
                title="Reset the 3D camera to its default view"
              >
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
            title="Displacement vs time"
            xLabel="t (s)"
            yLabel="x (m)"
            ySymmetric
            series={xSeries}
            clock={handle.clock}
            redrawKey={params}
            xDomain={[0, 4 * derived.T]}
            marker={{ x: () => handle.clock.getTime(), label: 'now' }}
            onPickX={(x) => handle.setTime(Math.max(0, Math.min(4 * derived.T, x)))}
            precision={2}
            ariaSummary={`x(t) sinusoid with amplitude ${formatValue(derived.amplitude)} m and period ${formatValue(derived.T)} s.`}
          />
        </div>
      }
      controls={
        <>
          <ParamSlider label="Mass" symbol="m" unit="kg" value={m} min={0.1} max={5} step={0.05} precision={2} onChange={(v) => setParam('m', v)} />
          <ParamSlider label="Spring constant" symbol="k" unit="N/m" value={k} min={1} max={200} step={1} precision={1} onChange={(v) => setParam('k', v)} />
          <ParamSlider label="Initial displacement" symbol="x₀" unit="m" value={x0} min={-0.5} max={0.5} step={0.005} precision={3} onChange={(v) => setParam('x0', v)} tooltip="Displacement from equilibrium at t = 0; positive = downward" />
          <ParamSlider label="Initial velocity" symbol="v₀" unit="m/s" value={v0} min={-3} max={3} step={0.05} precision={2} onChange={(v) => setParam('v0', v)} tooltip="Velocity at t = 0; positive = downward. A and φ are derived from x₀ and v₀." />
          <label className="checkbox-row">
            <input type="checkbox" checked={params.showVectors} onChange={(e) => setParam('showVectors', e.target.checked)} />
            Show velocity &amp; acceleration arrows
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={params.showForce} onChange={(e) => setParam('showForce', e.target.checked)} />
            Show spring-force arrow (F = −kx)
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={params.showRuler} onChange={(e) => setParam('showRuler', e.target.checked)} />
            Show displacement ruler
          </label>
          <p className="prose" style={{ fontSize: '0.78rem' }}>
            Dependency: <b>A</b> and <b>φ</b> are derived from x₀ and v₀ through
            A = √(x₀² + (v₀/ω)²) — they cannot be set independently in this initial-condition mode.
          </p>
        </>
      }
      model={
        <div className="prose">
          <p>
            <b>What this represents.</b> A block of mass <i>m</i> attached to an ideal spring of
            stiffness <i>k</i>, oscillating about the equilibrium position.
          </p>
          <p>
            <b>Assumptions (ideal model).</b> Massless spring; no friction or air drag; Hooke’s law
            holds for the whole range; the spring stays within its elastic limit. For this vertical
            arrangement, gravity only shifts the equilibrium point by the static stretch mg/k — the
            displacement x is measured from that equilibrium, so the equation of motion is unchanged.
          </p>
          <p>
            <b>Computed, not animated.</b> Positions come from the exact analytic solution
            x(t) = A cos(ωt + φ) evaluated at the simulation time — there is no numerical drift and
            no decorative easing. The 3D spring length, mass position and arrows are all derived
            from the same state.
          </p>
          <p>
            <b>Observe.</b> How T reacts to m and k; that v is largest at x = 0 while a is largest at
            the turning points; that F always points back toward equilibrium.
          </p>
        </div>
      }
      equations={<FormulaPanel items={formulas} />}
      prediction={
        <PredictionPanel
          scenarios={predictions}
          getParams={() => ({ ...params })}
          applyParams={(p) => {
            applyParams(p);
            handle.reset();
          }}
        />
      }
      investigations={<GuidedPanel experiments={GUIDED} onLoad={(setup) => { applyParams(setup); handle.reset(); }} />}
      practice={
        <PracticePanel
          moduleId="oscillatory-motion"
          generate={() => generateQuestion('oscillatory-motion')}
          onLoadToSim={(simParams, target) => {
            if (!target || target === 'spring') applyParams(simParams);
          }}
        />
      }
      actions={
        <>
          <SaveBar moduleId="oscillatory-motion" tabId="spring" params={params} defaultName="Spring–mass oscillator" />
          <button
            type="button"
            className="btn sm ghost"
            title="Export one full period of the motion as CSV"
            onClick={() => {
              const N = 240;
              const rows: (string | number)[][] = [];
              for (let i = 0; i <= N; i++) {
                const t = (derived.T * i) / N;
                const s = getState(t);
                rows.push([t.toFixed(5), s.x.toFixed(6), s.v.toFixed(6), s.a.toFixed(6), s.F.toFixed(6)]);
              }
              exportCsv('spring-mass-one-period.csv', ['t_s', 'x_m', 'v_m_per_s', 'a_m_per_s2', 'F_N'], rows);
            }}
          >
            CSV (1 period)
          </button>
        </>
      }
    />
  );
}
