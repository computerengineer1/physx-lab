import { Suspense, useEffect } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { getModule } from '../app/course';
import { useAppData } from '../state/data';
import { LAB_REGISTRY } from './registry';
import { ReviewPage } from './ReviewPage';

function LabLoader() {
  return (
    <div className="panel" style={{ display: 'grid', placeItems: 'center', minHeight: 240, gap: 10 }}>
      <Loader2 size={22} className="spin" style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
      <span className="prose">Loading laboratory…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Shared chrome for the five syllabus modules (B–F): header, CLO, section tabs. */
export function ModulePage({ moduleId }: { moduleId: string }) {
  const mod = getModule(moduleId);
  const { tab } = useParams();
  const navigate = useNavigate();
  const { markVisited } = useAppData();

  const active = mod?.sections.find((s) => s.path === tab) ?? mod?.sections[0];

  useEffect(() => {
    markVisited(moduleId);
  }, [moduleId, markVisited]);

  // Redirect /module → /module/<first section> so URLs stay shareable.
  useEffect(() => {
    if (mod && active && !tab) navigate(`${mod.route}/${active.path}`, { replace: true });
  }, [mod, tab, active, navigate]);

  if (!mod || !active) {
    return (
      <div className="panel">
        <p className="prose">
          Unknown module. <Link to="/library">Back to the Physics Library</Link>.
        </p>
      </div>
    );
  }

  const Lab = active.id === 'review' ? null : LAB_REGISTRY[mod.id]?.[active.id];

  return (
    <div>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Dashboard</Link> <ChevronRight size={12} />
        <Link to="/library">Library</Link> <ChevronRight size={12} />
        <span>{mod.title}</span>
      </nav>

      <div className="page-head">
        <div className="kicker">{mod.chapter}</div>
        <h1>{mod.title}</h1>
        <div className="row" style={{ marginTop: 8 }}>
          {active.syllabusRef && <span className="badge cyan">{active.syllabusRef}</span>}
          {mod.clo && (
            <span className="badge violet" title={mod.clo.text}>
              {mod.clo.id}: {mod.clo.text.length > 72 ? `${mod.clo.text.slice(0, 72)}…` : mod.clo.text}
            </span>
          )}
        </div>
      </div>

      <div className="section-tabs" role="tablist" aria-label={`${mod.title} sections`}>
        {mod.sections.map((s) => (
          <NavLink
            key={s.id}
            to={`${mod.route}/${s.path}`}
            role="tab"
            aria-selected={s.id === active.id}
            className={`section-tab ${s.id === active.id ? 'active' : ''}`}
          >
            {s.syllabusRef ? `${s.syllabusRef} · ` : ''}
            {s.label}
          </NavLink>
        ))}
      </div>

      <Suspense fallback={<LabLoader />}>
        {active.id === 'review' ? (
          <ReviewPage moduleId={mod.id} />
        ) : Lab ? (
          <Lab />
        ) : (
          <div className="panel">
            <p className="prose">This section is not registered. Please pick another section above.</p>
          </div>
        )}
      </Suspense>
    </div>
  );
}
