import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { FORMULAS } from '../education/formulas';
import { MODULES } from '../app/course';
import { FormulaCard } from '../components/sim/FormulaPanel';
import { useAppData } from '../state/data';

export function FormulaReferencePage() {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const { progress } = useAppData();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULAS.filter((f) => {
      if (moduleFilter !== 'all' && f.moduleId !== moduleFilter) return false;
      if (onlyBookmarked && !progress.bookmarks.includes(f.id)) return false;
      if (!q) return true;
      const mod = MODULES.find((m) => m.id === f.moduleId);
      const hay = `${f.title} ${f.tex} ${f.note ?? ''} ${f.sectionRef ?? ''} ${mod?.title ?? ''} ${f.variables
        .map((v) => `${v.sym} ${v.name} ${v.unit}`)
        .join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, moduleFilter, onlyBookmarked, progress.bookmarks]);

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Tools</div>
        <h1>Formula reference</h1>
        <p>
          Every formula used by the simulations, organized by syllabus module. Search by name,
          symbol or section number; bookmark the ones you need most (bookmarks are stored in this
          browser).
        </p>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: 1, maxWidth: 380, margin: 0 }}>
          <label className="field-label" htmlFor="formula-search">
            <Search size={13} /> Search formulas
          </label>
          <input
            id="formula-search"
            className="num-input"
            style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
            placeholder="e.g. snell, √(k/m), 18.4, power…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="checkbox-row" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={onlyBookmarked} onChange={(e) => setOnlyBookmarked(e.target.checked)} />
          <Star size={14} /> Bookmarked only ({progress.bookmarks.length})
        </label>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`preset-chip ${moduleFilter === 'all' ? 'active' : ''}`}
          aria-pressed={moduleFilter === 'all'}
          onClick={() => setModuleFilter('all')}
        >
          All modules
        </button>
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`preset-chip ${moduleFilter === m.id ? 'active' : ''}`}
            aria-pressed={moduleFilter === m.id}
            onClick={() => setModuleFilter(m.id)}
          >
            {m.shortTitle}
          </button>
        ))}
      </div>

      <div className="grid-2">
        {results.map((f) => {
          const mod = MODULES.find((m) => m.id === f.moduleId);
          return (
            <div key={f.id} className="panel">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="badge cyan">{f.sectionRef ?? 'supporting'}</span>
                <Link to={mod ? mod.route : '/library'} className="unit-tag" style={{ textDecoration: 'none' }}>
                  {mod?.title ?? f.moduleId} →
                </Link>
              </div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 6 }}>{f.title}</h3>
              <FormulaCard f={{ id: f.id, tex: f.tex, caption: f.note, variables: f.variables }} />
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <p className="prose">
              No formulas match the current filters.{' '}
              <button type="button" className="btn sm ghost" onClick={() => { setQuery(''); setModuleFilter('all'); setOnlyBookmarked(false); }}>
                Clear filters
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
