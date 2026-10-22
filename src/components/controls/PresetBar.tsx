export interface Preset<T> {
  id: string;
  label: string;
  params: T;
}

/**
 * Preset selector. Presets carry full parameter objects, so applying one
 * reconfigures the real simulation state (never a decorative swap).
 */
export function PresetBar<T>({
  presets,
  activeId,
  onApply,
  label = 'Presets',
}: {
  presets: Preset<T>[];
  activeId?: string | null;
  onApply: (preset: Preset<T>) => void;
  label?: string;
}) {
  return (
    <div className="row" role="group" aria-label={label} style={{ gap: 6 }}>
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`preset-chip ${activeId === p.id ? 'active' : ''}`}
          aria-pressed={activeId === p.id}
          onClick={() => onApply(p)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
