import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FlaskConical, Save, Sigma } from 'lucide-react';
import { MODULES } from '../app/course';
import { useAppData } from '../state/data';
import { useSettings } from '../state/settings';
import { listExperiments } from '../storage/experiments';
import { travellingWaveDisplacement } from '../physics/waves/travelling';

/** Live hero animation: an honest travelling wave, y = A sin(kx − ωt). */
function HeroWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!settings.reducedMotion) t += dt;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = 220;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cs = getComputedStyle(document.documentElement);
      const grid = cs.getPropertyValue('--grid-line').trim() || 'rgba(94,140,255,0.09)';
      // subtle grid
      ctx.strokeStyle = grid;
      for (let x = 0; x < w; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      const waves = [
        { A: 34, k: 0.021, om: 1.4, color: 'rgba(34,211,238,0.9)', phase: 0 },
        { A: 24, k: 0.033, om: -1.0, color: 'rgba(167,139,250,0.65)', phase: 1.4 },
        { A: 16, k: 0.05, om: 2.1, color: 'rgba(91,140,255,0.5)', phase: 2.8 },
      ];
      for (const wv of waves) {
        ctx.strokeStyle = wv.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 3) {
          // genuine sinusoid: A sin(kx − ωt + φ)
          const y = h / 2 - wv.A * Math.sin(wv.k * px - wv.om * t + wv.phase);
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }
      // a tracked medium particle (moves only vertically)
      const pxTrack = w * 0.62;
      const yTrack =
        h / 2 -
        (34 * Math.sin(0.021 * pxTrack - 1.4 * t) +
          24 * Math.sin(0.033 * pxTrack + 1.0 * t + 1.4) +
          16 * Math.sin(0.05 * pxTrack - 2.1 * t + 2.8));
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(pxTrack, yTrack, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      if (!settings.reducedMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [settings.reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: 220 }} />;
}

/** Static mini preview drawn from the module's real characteristic function. */
function ModulePreview({ moduleId, color }: { moduleId: string; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 300;
    const h = 92;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    const mid = h / 2;

    ctx.beginPath();
    if (moduleId === 'oscillatory-motion') {
      // decaying-free pure cosine = SHM x(t)
      for (let px = 0; px <= w; px += 2) {
        const y = mid - 30 * Math.cos((px / w) * 4 * Math.PI);
        if (px === 0) ctx.moveTo(px, y);

        else ctx.lineTo(px, y);
      }
    } else if (moduleId === 'wave-motion') {
      // travelling wave snapshot from the physics core (t fixed = 0)
      for (let px = 0; px <= w; px += 2) {
        const x = (px / w) * 6;
        const y = mid - 60 * travellingWaveDisplacement({ amplitude: 0.45, wavelength: 2.2, frequency: 1, phase: 0, direction: 1 }, x, 0);
        if (px === 0) ctx.moveTo(px, y);

        else ctx.lineTo(px, y);
      }
    } else if (moduleId === 'interference') {
      // standing wave envelope + shape
      ctx.strokeStyle = 'rgba(167,139,250,0.45)';
      for (let px = 0; px <= w; px += 2) {
        const x = (px / w) * 4 * Math.PI;
        const y = mid - 30 * Math.sin(x);
        if (px === 0) ctx.moveTo(px, y);

        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = color;
      for (let px = 0; px <= w; px += 2) {
        const x = (px / w) * 4 * Math.PI;
        const y = mid - 30 * Math.sin(x) * Math.cos(0.7);
        if (px === 0) ctx.moveTo(px, y);

        else ctx.lineTo(px, y);
      }
    } else if (moduleId === 'ray-optics') {
      // incident + reflected ray with normal
      ctx.moveTo(w * 0.2, 8);
      ctx.lineTo(w * 0.5, mid + 14);
      ctx.lineTo(w * 0.8, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.setLineDash([4, 4]);
      ctx.moveTo(w * 0.5, 6);
      ctx.lineTo(w * 0.5, h - 12);
      ctx.moveTo(w * 0.15, mid + 14);
      ctx.lineTo(w * 0.85, mid + 14);
    } else if (moduleId === 'image-formation') {
      // concave arc + object/image arrows
      ctx.strokeStyle = 'rgba(148,163,184,0.8)';
      ctx.beginPath();
      ctx.arc(w * 0.95, mid, w * 0.35, Math.PI * 0.68, Math.PI * 1.32);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = '#f472b6';
      ctx.moveTo(w * 0.25, mid + 18);
      ctx.lineTo(w * 0.25, mid - 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(w * 0.55, mid + 18);
      ctx.lineTo(w * 0.55, mid - 6);
    } else {
      // math review: axes + sqrt curve
      ctx.strokeStyle = 'rgba(148,163,184,0.6)';
      ctx.moveTo(14, h - 14);
      ctx.lineTo(w - 8, h - 14);
      ctx.moveTo(14, h - 14);
      ctx.lineTo(14, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = color;
      for (let px = 14; px <= w - 8; px += 2) {
        const x = ((px - 14) / (w - 22)) * 4;
        const y = h - 14 - Math.sqrt(x) * (h - 26) / 2;
        if (px === 14) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
    }
    ctx.stroke();
  }, [moduleId, color]);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: 92, display: 'block' }} />;
}

export function Dashboard() {
  const { recentModules, progress } = useAppData();
  const saved = listExperiments();
  const quizCount = Object.keys(progress.quiz).length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="hero">
        <div>
          <div className="kicker" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: 8 }}>
            PHYS220 · Physics for Engineers · Interactive Simulation Studio
          </div>
          <h1>
            See the equations <span className="grad">behave</span>.
          </h1>
          <p>
            PHYSX LAB turns the PHYS220 syllabus into working experiments: oscillators, travelling
            waves, standing waves, interference, ray optics and mirror imaging — each with live
            parameters, real-time calculations, synchronized graphs and guided investigations.
            Every number on screen comes from the same validated physics core.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <Link to="/oscillatory-motion/spring" className="btn primary">
              <FlaskConical size={16} /> Enter the laboratory
            </Link>
            <Link to="/library" className="btn">
              Browse all topics <ArrowRight size={15} />
            </Link>
            <Link to="/revision" className="btn ghost">
              Revision centre
            </Link>
          </div>
          <div className="row" style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--text-faint)' }}>
            <span className="badge">5 syllabus chapters</span>
            <span className="badge">16 interactive labs</span>
            <span className="badge">CLO-1 … CLO-5</span>
            <span className="badge">works offline after first load</span>
          </div>
        </div>
        <div className="hero-visual">
          <HeroWave />
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 12 }}>Course modules</h2>
        <div className="module-grid">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const visited = progress.visited[m.id];
            return (
              <Link key={m.id} to={`${m.route}${m.sections[0] ? `/${m.sections[0].path}` : ''}`} className="card card-link module-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="m-head">
                  <span className="m-icon" style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}>
                    <Icon size={19} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="m-chapter">{m.chapter}</span>
                    <span className="m-title" style={{ display: 'block' }}>{m.title}</span>
                  </span>
                  {visited && <span className="badge green" title={`Last opened ${new Date(visited).toLocaleString()}`}>opened</span>}
                </div>
                <div className="m-preview">
                  <ModulePreview moduleId={m.id} color={m.color} />
                </div>
                <div className="m-desc">{m.description}</div>
                <div className="m-foot">
                  <span className="unit-tag">
                    {m.isSupporting ? <><Sigma size={11} style={{ verticalAlign: -1 }} /> supporting material</> : m.clo?.id}
                  </span>
                  <span style={{ color: m.color, fontSize: '0.8rem', fontWeight: 600 }}>
                    {m.sections.length} sections <ArrowRight size={13} style={{ verticalAlign: -2 }} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid-2">
        <Panel2 title="Continue where you left off" icon={<Clock size={15} />}>
          {recentModules.length === 0 ? (
            <p className="prose" style={{ margin: 0 }}>
              Nothing visited yet — your recently opened laboratories will appear here (stored in
              this browser only). Start with <Link to="/oscillatory-motion/spring">the spring–mass lab</Link>.
            </p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {recentModules.slice(0, 5).map(({ moduleId, at }) => {
                const m = MODULES.find((x) => x.id === moduleId);
                if (!m) return null;
                return (
                  <Link key={moduleId} className="nav-link" to={`${m.route}${m.sections[0] ? `/${m.sections[0].path}` : ''}`}>
                    <span className="nav-dot" style={{ background: m.color }} />
                    <span style={{ flex: 1 }}>{m.title}</span>
                    <span className="unit-tag">{new Date(at).toLocaleDateString()} {new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel2>
        <Panel2 title="Saved configurations" icon={<Save size={15} />}>
          {saved.length === 0 ? (
            <p className="prose" style={{ margin: 0 }}>
              No saved experiments yet. Inside any laboratory, press <b>Save</b> to store its exact
              parameter set — then reopen it any time from{' '}
              <Link to="/experiments">My Experiments</Link>.
            </p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {saved.slice(-5).reverse().map((e) => {
                const m = MODULES.find((x) => x.id === e.moduleId);
                return (
                  <Link key={e.id} className="nav-link" to={m ? `${m.route}/${e.tabId}` : '/experiments'}>
                    <span className="nav-dot" style={{ background: m?.color ?? '#94a3b8' }} />
                    <span style={{ flex: 1 }}>{e.name}</span>
                    <span className="unit-tag">{new Date(e.savedAt).toLocaleDateString()}</span>
                  </Link>
                );
              })}
              <Link to="/experiments" className="btn sm ghost" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                Manage all ({saved.length}) <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </Panel2>
      </section>

      <section className="grid-3">
        <Link className="card card-link" to="/formulas" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Formula reference</h3>
          <p className="prose">Every PHYS220 equation with symbols, units and bookmarking — searchable by topic or symbol.</p>
        </Link>
        <Link className="card card-link" to="/math-review" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Math toolkit</h3>
          <p className="prose">Supporting revision: radians, sinusoids, units &amp; dimensions, notation and the calculus of motion.</p>
        </Link>
        <Link className="card card-link" to="/revision" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Revision centre</h3>
          <p className="prose">
            CLO-1 … CLO-5 review routes with generated practice questions
            {quizCount > 0 ? ` — best scores recorded for ${quizCount} module${quizCount > 1 ? 's' : ''}.` : '.'}
          </p>
        </Link>
      </section>
    </div>
  );
}

function Panel2({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-title">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
