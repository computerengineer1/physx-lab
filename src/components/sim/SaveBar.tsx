import { useState } from 'react';
import { Download, Save, Upload } from 'lucide-react';
import { useToast, Modal } from '../ui/primitives';
import { saveExperiment, toParamSet } from '../../storage/experiments';

/**
 * Save-to-storage + export buttons shared by every lab. Saving stores the
 * real parameter object; export downloads it as JSON (validated on import
 * in My Experiments — never evaluated).
 */
export function SaveBar({
  moduleId,
  tabId,
  params,
  defaultName,
}: {
  moduleId: string;
  tabId: string;
  params: object;
  defaultName: string;
}) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);

  const doSave = () => {
    const res = saveExperiment({ moduleId, tabId, name: name.trim() || defaultName, params: toParamSet(params) });
    if (res.ok) {
      push(`Saved “${res.experiment.name}” to My Experiments (this browser only).`, 'ok');
      setOpen(false);
    } else {
      push(res.error, 'error');
    }
  };

  const doExport = () => {
    const blob = new Blob(
      [JSON.stringify({ moduleId, tabId, name: defaultName, params, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleId}-${tabId}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    push('Configuration exported as JSON.', 'ok');
  };

  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        <Save size={13} /> Save
      </button>
      <button type="button" className="btn sm ghost" onClick={doExport} title="Download this configuration as JSON">
        <Download size={13} /> Export
      </button>
      {open && (
        <Modal
          title="Save experiment"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn primary sm" onClick={doSave}>
                <Save size={13} /> Save configuration
              </button>
            </>
          }
        >
          <p className="prose" style={{ marginTop: 0 }}>
            Saves the current parameters of <b>{defaultName}</b> in this browser’s local storage
            (no account, no cloud sync).
          </p>
          <label className="field-label" htmlFor="save-name">
            Name
          </label>
          <input
            id="save-name"
            className="num-input"
            style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSave()}
          />
          <p className="prose mono" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>
            <Upload size={11} style={{ verticalAlign: -1 }} /> {JSON.stringify(params)}
          </p>
        </Modal>
      )}
    </>
  );
}

/** Export a dataset (e.g. sampled model output) as CSV. */
export function exportCsv(
  filename: string,
  columns: string[],
  rows: (string | number)[][],
): void {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
