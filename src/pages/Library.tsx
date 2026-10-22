import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { COURSE, MODULES } from '../app/course';
import { useAppData } from '../state/data';

export function LibraryPage() {
  const [query, setQuery] = useState('');
  const { progress } = useAppData();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return MODULES;
    return MODULES.map((m) => ({
      ...m,
      sections: m.sections.filter((s) =>
        `${s.label} ${s.syllabusRef ?? ''} ${m.title} ${m.chapter}`.toLowerCase().includes(q),
      ),
    })).filter((m) => m.sections.length > 0 || m.title.toLowerCase().includes(q));
  }, [q]);

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Physics Library</div>
        <h1>All syllabus topics</h1>
        <p>
          {COURSE.code} — {COURSE.title}, {COURSE.institution}, {COURSE.semester} ({COURSE.credits}{' '}
          credit hours). Modules follow the supplied syllabus; section numbers are the textbook
          references listed there. Module A is supporting study material for the syllabus’s
          mathematical-revision block.
        </p>
      </div>

      <div className="field" style={{ maxWidth: 420, marginBottom: 18 }}>
        <label className="field-label" htmlFor="lib-search">
          <Search size={13} /> Filter topics
        </label>
        <input
          id="lib-search"
          className="num-input"
          style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
          placeholder="e.g. refraction, §18.2, CLO-4, standing…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="stack" style={{ gap: 16 }}>
        {filtered.map((m) => {
          const Icon = m.icon;
          return (
            <section key={m.id} className="panel">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="row">
                  <span
                    className="m-icon"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'grid',
                      placeItems: 'center',
                      background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
                      color: m.color,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="m-chapter" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>
                      {m.chapter}
                    </span>
                    <h2>{m.title}</h2>
                  </span>
                </div>
                <span className="row">
                  {m.isSupporting ? (
                    <span className="badge">supporting material</span>
                  ) : (
                    m.clo && <span className="badge violet" title={m.clo.text}>{m.clo.id}</span>
                  )}
                  {progress.visited[m.id] && <span className="badge green">opened</span>}
                </span>
              </div>
              <p className="prose">{m.description}</p>
              {m.clo && (
                <p className="prose" style={{ fontSize: '0.82rem' }}>
                  <b>{m.clo.id}:</b> {m.clo.text}
                </p>
              )}
              <div className="grid-3" style={{ marginTop: 10 }}>
                {m.sections.map((s) => (
                  <Link
                    key={s.id}
                    to={`${m.route}/${s.path}`}
                    className="card"
                    style={{ padding: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {s.syllabusRef && <span className="badge cyan" style={{ marginRight: 6 }}>{s.syllabusRef}</span>}
                      <span style={{ fontSize: '0.86rem', color: 'var(--text)', fontWeight: 600 }}>{s.label}</span>
                    </span>
                    <ArrowRight size={14} style={{ color: m.color, flex: 'none' }} />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <div className="panel">
            <p className="prose">
              No topics match “{query}”. Try a section number like <b>16.3</b>, a keyword like{' '}
              <b>mirror</b>, or <Link to="/library">clear the filter</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
