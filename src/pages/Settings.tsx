import { useMemo, useState } from 'react';
import { AlertTriangle, Moon, Palette, Sun, Trash2, Zap } from 'lucide-react';
import { COURSE } from '../app/course';
import { Modal } from '../components/ui/primitives';
import { useSettings } from '../state/settings';
import { clearAllData, isStorageAvailable, usageBytes } from '../storage/local';
import { listExperiments } from '../storage/experiments';
import { loadProgress } from '../storage/progress';

export function SettingsPage() {
  const { settings, setTheme, setReducedMotion, setLowEffects } = useSettings();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearedAt, setClearedAt] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (clearedAt) return { usage: 0, experiments: 0, bookmarks: 0 };
    void clearedAt;
    const progress = loadProgress();
    return {
      usage: usageBytes(),
      experiments: listExperiments().length,
      bookmarks: progress.bookmarks.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClear, clearedAt]);

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Tools</div>
        <h1>Settings</h1>
        <p>Preferences are stored in this browser and applied immediately.</p>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-title"><Palette size={15} /> Appearance</div>
          <div className="field">
            <span className="field-label">Theme</span>
            <div className="segmented" role="group" aria-label="Theme">
              <button type="button" aria-pressed={settings.theme === 'dark'} onClick={() => setTheme('dark')}>
                <Moon size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Dark laboratory
              </button>
              <button type="button" aria-pressed={settings.theme === 'light'} onClick={() => setTheme('light')}>
                <Sun size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Light
              </button>
            </div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
            Reduced motion — disables decorative UI transitions (simulations keep their play/pause
            controls; the system preference is used as the initial value)
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.lowEffects} onChange={(e) => setLowEffects(e.target.checked)} />
            <Zap size={14} /> Low-effects mode — capped pixel ratio, no shadows, no antialiasing in
            3D scenes (for slower devices; physics is unaffected)
          </label>
        </section>

        <section className="panel">
          <div className="panel-title"><AlertTriangle size={15} /> Local data</div>
          <p className="prose">
            PHYSX LAB keeps everything on this device — nothing is uploaded, and there is no
            account. If browser storage is unavailable (e.g. strict private mode), the app still
            works but cannot remember preferences or saved experiments.
          </p>
          <table className="table-simple">
            <tbody>
              <tr><td>Storage available</td><td className="mono">{isStorageAvailable() ? 'yes' : 'no'}</td></tr>
              <tr><td>Approx. usage</td><td className="mono">{(stats.usage / 1024).toFixed(1)} kB</td></tr>
              <tr><td>Saved experiments</td><td className="mono">{stats.experiments}</td></tr>
              <tr><td>Bookmarked formulas</td><td className="mono">{stats.bookmarks}</td></tr>
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn danger" onClick={() => setConfirmClear(true)}>
              <Trash2 size={14} /> Clear all local data…
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Language</div>
          <p className="prose">
            <b>Interface language: English.</b> The PHYS220 syllabus is taught in English, and this
            release ships a complete English interface. A future Arabic interface would require a
            full RTL layout and complete scientific translation; rather than offering a selector
            that translates only a few headings, no language switch is shown until a complete
            translation exists. Unit symbols and mathematical notation already follow international
            (SI) conventions.
          </p>
        </section>

        <section className="panel">
          <div className="panel-title">About</div>
          <p className="prose">
            <b>PHYSX LAB</b> — Interactive Physics Simulation Studio for{' '}
            <b>{COURSE.code} {COURSE.title}</b> ({COURSE.institution}, {COURSE.semester},{' '}
            {COURSE.credits} credits). Modules follow the supplied syllabus: Chapter 15
            (oscillatory motion), Chapter 16 (wave motion), Chapter 18 (§18.1, §18.2, §18.4 —
            superposition and standing waves), Chapter 35 (§35.4, §35.5, §35.8 — ray optics) and
            Chapter 36 (image formation), plus a mathematical-revision toolkit labelled as
            supporting material.
          </p>
          <p className="prose">
            All simulations evaluate analytic solutions of the ideal models at the current
            simulation time (fixed-timestep clocks, frame-rate independent). Idealizations
            (no damping, massless springs, paraxial rays, …) are stated inside every laboratory’s
            “Physical model” panel.
          </p>
        </section>
      </div>

      {confirmClear && (
        <Modal
          title="Clear all local data?"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <button type="button" className="btn ghost sm" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => {
                  clearAllData();
                  setConfirmClear(false);
                  setClearedAt(Date.now());
                  // Re-apply defaults and reload so every store re-initializes cleanly.
                  window.location.reload();
                }}
              >
                <Trash2 size={13} /> Delete everything
              </button>
            </>
          }
        >
          <p className="prose">
            This permanently deletes your saved experiments, bookmarks, settings and progress from
            this browser. Export your experiments first if you want to keep them.
          </p>
        </Modal>
      )}
    </div>
  );
}
