import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, FileUp, Pencil, Save, Trash2, Copy } from 'lucide-react';
import { MODULES } from '../app/course';
import { Modal, useToast } from '../components/ui/primitives';
import {
  deleteExperiment,
  duplicateExperiment,
  exportExperimentsAsJson,
  importExperimentsFromJson,
  listExperiments,
  renameExperiment,
} from '../storage/experiments';
import type { SavedExperiment } from '../storage/experiments';
import { setPendingConfig } from '../storage/local';

export function MyExperimentsPage() {
  const [items, setItems] = useState<SavedExperiment[]>(() => listExperiments());
  const [renaming, setRenaming] = useState<SavedExperiment | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<SavedExperiment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();
  const navigate = useNavigate();

  const refresh = useCallback(() => setItems(listExperiments()), []);

  const open = (e: SavedExperiment) => {
    const mod = MODULES.find((m) => m.id === e.moduleId);
    if (!mod) {
      push(`Unknown module “${e.moduleId}” in saved experiment — cannot open it.`, 'error');
      return;
    }
    if (!mod.sections.some((s) => s.path === e.tabId)) {
      push(`Saved tab “${e.tabId}” no longer exists in ${mod.title}; opening the module instead.`, 'error');
      navigate(mod.route);
      return;
    }
    setPendingConfig(`${e.moduleId}:${e.tabId}`, e.params);
    navigate(`${mod.route}/${e.tabId}`);
  };

  const doExport = () => {
    const blob = new Blob([exportExperimentsAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'physx-lab-experiments.json';
    a.click();
    URL.revokeObjectURL(url);
    push(`Exported ${items.length} configuration(s).`, 'ok');
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const report = importExperimentsFromJson(text);
      if (report.error) push(report.error, 'error');
      else {
        push(
          `Imported ${report.imported} configuration(s)${report.rejected.length > 0 ? `; ${report.rejected.length} rejected (invalid or unsupported schema)` : ''}.`,
          report.imported > 0 ? 'ok' : 'error',
        );
        refresh();
      }
    };
    reader.onerror = () => push('Could not read the selected file.', 'error');
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="page-head">
        <div className="kicker">Tools</div>
        <h1>My experiments</h1>
        <p>
          Saved laboratory configurations, stored in <b>this browser only</b> (localStorage) — no
          account, no cloud sync. Export to move them to another device; imports are validated
          before anything is stored, and file contents are never executed.
        </p>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button type="button" className="btn" onClick={doExport} disabled={items.length === 0}>
          <Download size={15} /> Export all as JSON
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} /> Import from file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Import experiment configurations from a JSON file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {items.length === 0 ? (
        <div className="panel">
          <p className="prose">
            <Save size={14} style={{ verticalAlign: -2 }} /> Nothing saved yet. Open any laboratory
            (for example <button type="button" className="btn sm ghost" onClick={() => navigate('/oscillatory-motion/spring')}>the spring–mass lab</button>)
            and press <b>Save</b> in its Parameters panel to store the exact configuration.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {items.map((e) => {
            const mod = MODULES.find((m) => m.id === e.moduleId);
            return (
              <div key={e.id} className="panel">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <span className="badge cyan" style={{ marginRight: 8 }}>{mod?.shortTitle ?? e.moduleId}</span>
                    <span className="badge">{e.tabId}</span>
                  </span>
                  <span className="unit-tag">{new Date(e.savedAt).toLocaleString()}</span>
                </div>
                <h3 style={{ margin: '8px 0 4px', fontSize: '1rem' }}>{e.name}</h3>
                <p className="prose mono" style={{ fontSize: '0.72rem', wordBreak: 'break-all', maxHeight: 54, overflow: 'hidden' }}>
                  {JSON.stringify(e.params)}
                </p>
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn primary sm" onClick={() => open(e)}>
                    <ExternalLink size={13} /> Open in lab
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => { setRenaming(e); setRenameValue(e.name); }} aria-label={`Rename ${e.name}`}>
                    <Pencil size={13} /> Rename
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    aria-label={`Duplicate ${e.name}`}
                    onClick={() => {
                      const res = duplicateExperiment(e.id);
                      if (res.ok) { push(`Duplicated as “${res.experiment.name}”.`, 'ok'); refresh(); }
                      else push(res.error, 'error');
                    }}
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => setDeleting(e)} aria-label={`Delete ${e.name}`}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renaming && (
        <Modal
          title="Rename experiment"
          onClose={() => setRenaming(null)}
          footer={
            <>
              <button type="button" className="btn ghost sm" onClick={() => setRenaming(null)}>Cancel</button>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => {
                  const res = renameExperiment(renaming.id, renameValue);
                  if (res.ok) { push('Renamed.', 'ok'); setRenaming(null); refresh(); }
                  else push(res.error, 'error');
                }}
              >
                Save name
              </button>
            </>
          }
        >
          <input
            className="num-input"
            style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
            value={renameValue}
            maxLength={120}
            aria-label="New name"
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Delete experiment?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button type="button" className="btn ghost sm" onClick={() => setDeleting(null)}>Keep it</button>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => {
                  const res = deleteExperiment(deleting.id);
                  if (res.ok) { push(`Deleted “${deleting.name}”.`, 'ok'); setDeleting(null); refresh(); }
                  else push(res.error, 'error');
                }}
              >
                <Trash2 size={13} /> Delete permanently
              </button>
            </>
          }
        >
          <p className="prose">
            “{deleting.name}” will be removed from this browser. This cannot be undone — export
            first if you might need it later.
          </p>
        </Modal>
      )}
    </div>
  );
}
