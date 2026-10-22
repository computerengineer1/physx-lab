import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import { MODULES } from '../app/course';
import { useAppData } from '../state/data';
import { Accordion } from '../components/ui/primitives';
import { PracticePanel } from '../components/education/PracticePanel';
import { generateQuestion } from '../education/questions';
import { setPendingConfig } from '../storage/local';
import { useNavigate } from 'react-router-dom';

/**
 * Revision centre — syllabus-aligned review routes for CLO-1 … CLO-5.
 *
 * Honesty rules implemented here:
 *  - "Opened" status only records navigation; it never claims mastery.
 *  - Quiz performance is tracked separately, with score and date.
 *  - Module A is labelled as supporting material without a CLO.
 */
export function RevisionPage() {
  const { progress } = useAppData();
  const navigate = useNavigate();

  const cloModules = MODULES.filter((m) => m.clo);

  const loadInSim = useCallback(
    (moduleId: string) =>
      (params: Record<string, number | boolean | string>, target?: string) => {
        const mod = MODULES.find((m) => m.id === moduleId);
        if (!mod) return;
        const tab = target && mod.sections.some((s) => s.path === target) ? target : mod.sections[0]?.path;
        if (!tab) return;
        setPendingConfig(`${moduleId}:${tab}`, params);
        navigate(`${mod.route}/${tab}`);
      },
    [navigate],
  );

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Tools</div>
        <h1>Revision centre</h1>
        <p>
          A syllabus-aligned route through the five course learning outcomes. Status shown here is
          factual: <b>opened</b> means you visited the module; <b>quiz score</b> means you answered
          generated questions — neither is a mastery claim, and both live in this browser only.
        </p>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {cloModules.map((m) => {
          const visited = progress.visited[m.id];
          const quiz = progress.quiz[m.id];
          const Icon = m.icon;
          const reviewPath = `${m.route}/review`;
          return (
            <section key={m.id} className="panel">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none',
                      background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color, border: '1px solid var(--border)',
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="badge violet">{m.clo?.id}</span>
                    <h2 style={{ fontSize: '1.05rem', marginTop: 4 }}>{m.chapter} — {m.title}</h2>
                    <p className="prose" style={{ margin: '4px 0 0', maxWidth: '85ch' }}>{m.clo?.text}</p>
                  </span>
                </div>
                <div className="stack" style={{ gap: 4, minWidth: 190 }}>
                  <span className={`badge ${visited ? 'green' : ''}`}>
                    {visited ? <><CheckCircle2 size={12} /> opened {new Date(visited).toLocaleDateString()}</> : 'not opened yet'}
                  </span>
                  <span className={`badge ${quiz ? 'amber' : ''}`}>
                    {quiz
                      ? `best quiz: ${quiz.correct}/${quiz.total} (${new Date(quiz.at).toLocaleDateString()})`
                      : 'no quiz attempt recorded'}
                  </span>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn sm" to={reviewPath}>
                  <BookOpen size={13} /> Chapter review &amp; concept map
                </Link>
                {m.sections.filter((s) => s.path !== 'review').map((s) => (
                  <Link key={s.id} className="btn sm ghost" to={`${m.route}/${s.path}`}>
                    {s.syllabusRef ?? ''} {s.label}
                  </Link>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <Accordion
                  title={<span><GraduationCap size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Knowledge check — {m.clo?.id}</span>}
                  badge={quiz ? <span className="badge amber">{quiz.correct}/{quiz.total}</span> : undefined}
                >
                  <PracticePanel
                    moduleId={m.id}
                    generate={() => generateQuestion(m.id)}
                    onLoadToSim={loadInSim(m.id)}
                  />
                </Accordion>
              </div>
            </section>
          );
        })}

        <section className="panel">
          <div className="row">
            <ArrowRight size={16} style={{ color: 'var(--cyan)' }} />
            <p className="prose" style={{ margin: 0 }}>
              <b>Module A (Mathematical revision)</b> is supporting study material without a CLO:{' '}
              <Link to="/math-review">open the Math Toolkit</Link> to refresh radians, sinusoids,
              units/dimensions, scientific notation and the calculus ideas behind motion and waves.
              All formula summaries are collected in the{' '}
              <Link to="/formulas">Formula Reference</Link> (bookmark them as you revise).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
