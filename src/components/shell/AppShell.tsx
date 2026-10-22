import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  FlaskConical,
  Home,
  Menu,
  Moon,
  Save,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { COURSE, MODULES } from '../../app/course';
import { useSettings } from '../../state/settings';

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="brandg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#4f7dff" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="url(#brandg)" strokeWidth="3" />
      <path
        d="M8 40 C 14 40, 14 24, 20 24 S 26 40, 32 40 S 38 24, 44 24 S 50 40, 56 40"
        fill="none"
        stroke="url(#brandg)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="32" cy="14" r="3.4" fill="#fbbf24" />
    </svg>
  );
}

interface SearchHit {
  label: string;
  sub: string;
  to: string;
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const hits = useMemo<SearchHit[]>(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const out: SearchHit[] = [];
    for (const m of MODULES) {
      if (
        m.title.toLowerCase().includes(query) ||
        m.shortTitle.toLowerCase().includes(query) ||
        m.chapter.toLowerCase().includes(query) ||
        m.clo?.id.toLowerCase().includes(query)
      ) {
        out.push({ label: m.title, sub: m.chapter, to: m.route });
      }
      for (const s of m.sections) {
        const text = `${s.label} ${s.syllabusRef ?? ''}`.toLowerCase();
        if (text.includes(query)) {
          out.push({
            label: s.label,
            sub: `${m.shortTitle}${s.syllabusRef ? ` · ${s.syllabusRef}` : ''}`,
            to: `${m.route}/${s.path}`,
          });
        }
      }
    }
    const pages: [string, string, string][] = [
      ['Formula reference', 'Tools', '/formulas'],
      ['My experiments', 'Tools', '/experiments'],
      ['Revision centre', 'Tools', '/revision'],
      ['Mathematical revision', 'Module A', '/math-review'],
      ['Physics library', 'All topics', '/library'],
    ];
    for (const [label, sub, to] of pages) {
      if (label.toLowerCase().includes(query)) out.push({ label, sub, to });
    }
    return out.slice(0, 8);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} style={{ position: 'relative', maxWidth: 300, flex: 1 }}>
      <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-faint)' }} />
      <input
        className="num-input"
        style={{ width: '100%', textAlign: 'left', paddingLeft: 28, fontFamily: 'var(--font-sans)' }}
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-label="Search topics, sections and tools"
        placeholder="Search topics, § sections…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) {
            navigate(hits[0].to);
            setOpen(false);
            setQ('');
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && hits.length > 0 && (
        <div
          className="panel"
          role="listbox"
          aria-label="Search results"
          style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 80, padding: 6 }}
        >
          {hits.map((h) => (
            <Link
              key={h.to + h.label}
              role="option"
              aria-selected={false}
              to={h.to}
              className="nav-link"
              onClick={() => {
                setOpen(false);
                setQ('');
              }}
              style={{ padding: '7px 9px' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.85rem' }}>{h.label}</span>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-faint)' }}>{h.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const { settings, setTheme } = useSettings();

  // Close the mobile drawer when the route changes — render-time adjustment
  // (React-recommended pattern; no cascading effect renders).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setNavOpen(false);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <button
          type="button"
          className="btn ghost icon-only sidebar-toggle"
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link to="/" className="brand" aria-label="PHYSX LAB home">
          <BrandMark />
          <span>
            <span className="brand-name">PHYSX LAB</span>
            <span className="brand-sub">Interactive Physics Simulation Studio</span>
          </span>
        </Link>
        <span className="header-spacer" />
        <GlobalSearch />
        <span className="header-course">
          {COURSE.code} · {COURSE.title}
        </span>
        <button
          type="button"
          className="btn ghost icon-only"
          aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
        >
          {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {navOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setNavOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <nav className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="nav-section-title">Workspace</div>
        <NavLink to="/" className="nav-link" end>
          <Home size={16} /> Dashboard
        </NavLink>
        <NavLink to="/library" className="nav-link">
          <BookOpen size={16} /> Physics Library
        </NavLink>

        <div className="nav-section-title">PHYS220 Modules</div>
        {MODULES.map((m) => (
          <NavLink key={m.id} to={m.route} className="nav-link">
            <span className="nav-dot" style={{ background: m.color }} aria-hidden="true" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.shortTitle}
              </span>
              <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-faint)' }}>
                {m.chapter.replace('Module ', 'Mod. ')}
                {m.clo ? ` · ${m.clo.id}` : ''}
              </span>
            </span>
          </NavLink>
        ))}

        <div className="nav-section-title">Tools</div>
        <NavLink to="/formulas" className="nav-link">
          <Compass size={16} /> Formula Reference
        </NavLink>
        <NavLink to="/experiments" className="nav-link">
          <Save size={16} /> My Experiments
        </NavLink>
        <NavLink to="/revision" className="nav-link">
          <FlaskConical size={16} /> Revision Centre
        </NavLink>
        <NavLink to="/settings" className="nav-link">
          <Settings size={16} /> Settings
        </NavLink>
      </nav>

      <main className="main-area" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
