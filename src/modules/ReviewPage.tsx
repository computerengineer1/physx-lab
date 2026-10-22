import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Network } from 'lucide-react';
import { getModule } from '../app/course';
import { formulasForModule } from '../education/formulas';
import { generateQuestion } from '../education/questions';
import { PracticePanel } from '../components/education/PracticePanel';
import { FormulaPanel } from '../components/sim/FormulaPanel';
import type { DisplayedFormula } from '../components/sim/FormulaPanel';
import { Panel } from '../components/ui/primitives';
import { setPendingConfig } from '../storage/local';

interface ConceptNode {
  concept: string;
  links: string[];
}

/** Original concept maps — one per syllabus chapter. */
const CONCEPT_MAPS: Record<string, { title: string; nodes: ConceptNode[] }> = {
  'oscillatory-motion': {
    title: 'Chapter 15 concept map',
    nodes: [
      { concept: 'Spring force F = −kx', links: ['Hooke’s law restores the mass toward equilibrium', 'With Newton’s 2nd law ⇒ m x″ + kx = 0'] },
      { concept: 'SHM solution x = A cos(ωt + φ)', links: ['ω = √(k/m) set by the system, not the amplitude', 'A and φ set by initial conditions x₀, v₀'] },
      { concept: 'Period T = 2π√(m/k)', links: ['Independent of amplitude (ideal spring)', 'Frequency f = 1/T = ω/2π'] },
      { concept: 'Energy E = ½kA² = K + U', links: ['K maximal at equilibrium', 'U maximal at turning points', 'E constant without damping'] },
      { concept: 'Circular-motion projection', links: ['Uniform circular motion of radius A projects to x = A cos(ωt + φ)', 'Explains phase and the sinusoidal form'] },
    ],
  },
  'wave-motion': {
    title: 'Chapter 16 concept map',
    nodes: [
      { concept: 'Disturbance propagates, medium does not', links: ['Particles oscillate locally about fixed positions', 'The profile moves at the wave speed v'] },
      { concept: 'Wave function y = A sin(kx − ωt + φ)', links: ['k = 2π/λ sets spatial periodicity', 'ω = 2πf sets temporal periodicity', 'Sign of ωt term sets direction'] },
      { concept: 'Wave speed', links: ['Any wave: v = fλ = ω/k', 'On a string (medium property): v = √(Tₛ/μ)'] },
      { concept: 'Energy transport', links: ['P_avg = ½ μω²A²v', 'Power ∝ A² and ∝ f²'] },
    ],
  },
  interference: {
    title: 'Chapter 18 concept map',
    nodes: [
      { concept: 'Superposition y = y₁ + y₂', links: ['Linear media: waves pass through unchanged', 'Interference = phase-dependent addition'] },
      { concept: 'Interference of co-propagating waves', links: ['A_R = √(A₁² + A₂² + 2A₁A₂cos Δφ)', 'Δφ = 0 ⇒ constructive; Δφ = π ⇒ destructive'] },
      { concept: 'Standing waves', links: ['Equal waves in opposite directions', 'y = 2A sin(kx) cos(ωt)', 'Nodes fixed; antinodes oscillate ±2A'] },
      { concept: 'Boundary conditions (both ends fixed)', links: ['y(0) = y(L) = 0 ⇒ kL = nπ', 'λₙ = 2L/n and fₙ = nv/(2L)', 'Only integer harmonics are allowed'] },
    ],
  },
  'ray-optics': {
    title: 'Chapter 35 concept map',
    nodes: [
      { concept: 'Ray model of light', links: ['Valid when apertures ≫ wavelength', 'Rays travel straight in a uniform medium'] },
      { concept: 'Reflection θᵣ = θᵢ', links: ['Both angles measured from the normal', 'Holds for any smooth interface'] },
      { concept: 'Refraction n₁ sin θ₁ = n₂ sin θ₂', links: ['n = c/v: denser medium ⇒ slower light', 'Entering denser medium bends toward the normal'] },
      { concept: 'Total internal reflection', links: ['Only when n₁ > n₂', 'θ₁ > θ_c = arcsin(n₂/n₁) ⇒ no transmitted ray', 'Basis of optical fibres'] },
    ],
  },
  'image-formation': {
    title: 'Chapter 36 concept map',
    nodes: [
      { concept: 'Flat mirror', links: ['dᵢ = −dₒ, m = +1', 'Always virtual, upright, same size'] },
      { concept: 'Spherical mirror equation', links: ['1/f = 1/dₒ + 1/dᵢ with f = R/2', 'Concave f > 0, convex f < 0 (real-is-positive)', 'm = −dᵢ/dₒ = hᵢ/hₒ'] },
      { concept: 'Image nature from signs', links: ['dᵢ > 0 real, dᵢ < 0 virtual', 'm < 0 inverted, m > 0 upright', '|m| ≷ 1 magnified/reduced'] },
      { concept: 'Principal rays', links: ['∥ axis → through F (or from F for convex)', 'Through F → ∥ axis after reflection', 'Through C → back on itself', 'Real rays solid; virtual extensions dashed'] },
      { concept: 'Singular case dₒ = f', links: ['Reflected rays parallel ⇒ image at infinity', 'The model reports this limit explicitly'] },
    ],
  },
};

/**
 * Chapter review & practice: concept map, key equations, and generated
 * questions whose numeric answers come from the simulation physics core.
 * "Load in simulation" stages the question parameters and navigates to the
 * matching lab tab.
 */
export function ReviewPage({ moduleId }: { moduleId: string }) {
  const mod = getModule(moduleId);
  const navigate = useNavigate();

  const formulas = useMemo<DisplayedFormula[]>(
    () =>
      formulasForModule(moduleId).map((f) => ({
        id: f.id,
        tex: f.tex,
        caption: f.sectionRef ? `${f.title} — ${f.sectionRef}` : f.title,
        variables: f.variables,
      })),
    [moduleId],
  );

  const generate = useCallback(() => generateQuestion(moduleId), [moduleId]);

  const map = CONCEPT_MAPS[moduleId];

  const loadInSim = useCallback(
    (params: Record<string, number | boolean | string>, target?: string) => {
      if (!mod) return;
      const firstLab = mod.sections.find((s) => s.path !== 'review');
      const tabId = target && mod.sections.some((s) => s.path === target) ? target : firstLab?.path;
      if (!tabId) return;
      setPendingConfig(`${moduleId}:${tabId}`, params);
      navigate(`${mod.route}/${tabId}`);
    },
    [mod, moduleId, navigate],
  );

  if (!mod) return null;

  return (
    <div className="grid-2">
      <Panel title="Key equations" icon={<BookOpen size={15} />}>
        {formulas.length > 0 ? (
          <FormulaPanel items={formulas} />
        ) : (
          <p className="prose">
            This module’s equations are listed in the{' '}
            <Link to="/formulas">Formula Reference</Link>.
          </p>
        )}
      </Panel>

      <div className="stack">
        {map && (
          <Panel title={map.title} icon={<Network size={15} />}>
            <div className="stack" style={{ gap: 8 }}>
              {map.nodes.map((n) => (
                <div key={n.concept} className="eq-block" style={{ marginBottom: 0 }}>
                  <b style={{ fontSize: '0.9rem' }}>{n.concept}</b>
                  <ul className="prose" style={{ margin: '4px 0 0' }}>
                    {n.links.map((l) => (
                      <li key={l}>
                        <ArrowRight size={11} style={{ verticalAlign: -1, marginRight: 5, color: 'var(--cyan)' }} />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Practice — generated questions" icon={<BookOpen size={15} />}>
          <p className="prose" style={{ marginTop: 0 }}>
            Original questions with randomized, physically valid values. Numeric answers are
            computed by the same physics core the simulations run on. Full worked solutions are
            available after each attempt. Questions that carry a configuration can be loaded
            straight into the matching laboratory.
          </p>
          <PracticePanel
            moduleId={moduleId}
            generate={generate}
            onLoadToSim={(params, target) => loadInSim(params, target)}
          />
        </Panel>
      </div>
    </div>
  );
}
