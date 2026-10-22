import { useId, useState } from 'react';
import { InlineError } from '../ui/primitives';

export interface ParamSliderProps {
  label: string;
  /** Symbol shown next to the label, e.g. "k". */
  symbol?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Decimals shown in the numeric input. */
  precision?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  tooltip?: string;
}

/**
 * Slider + numeric input kept in sync. The numeric field validates on
 * commit: non-numeric input is rejected with an explanatory message and the
 * previous valid value is restored; out-of-range values are clamped with a
 * note. NaN/Infinity never propagate to the model.
 */
export function ParamSlider({
  label,
  symbol,
  unit,
  value,
  min,
  max,
  step,
  precision = 2,
  onChange,
  disabled = false,
  tooltip,
}: ParamSliderProps) {
  const id = useId();
  const inputId = `${id}-num`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Re-sync the draft when the value changes externally (presets, drags).
  // Render-time state adjustment (React-recommended pattern; avoids effect cascades).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(null);
    setError(null);
    setNote(null);
  }

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim().replace(/,/g, '.');
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed)) {
      setError(`Enter a finite number for ${label}.`);
      setDraft(null);
      return;
    }
    if (parsed < min || parsed > max) {
      const clamped = Math.min(max, Math.max(min, parsed));
      setNote(`${trimmed} is outside [${min}, ${max}] — clamped to ${clamped}.`);
      setError(null);
      onChange(clamped);
      setDraft(null);
      return;
    }
    setError(null);
    setNote(null);
    onChange(parsed);
    setDraft(null);
  };

  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId} title={tooltip}>
        <span>
          {symbol && <span className="symbol">{symbol}</span>} {label}
        </span>
        {unit && <span className="unit-tag">{unit}</span>}
      </label>
      <div className="field-row">
        <input
          type="range"
          id={`${id}-range`}
          aria-label={`${label} slider${unit ? ` in ${unit}` : ''}`}
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          disabled={disabled}
          style={{ '--fill': `${pct}%` } as React.CSSProperties}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) {
              setError(null);
              setNote(null);
              onChange(v);
            }
          }}
        />
        <input
          className={`num-input ${error ? 'invalid' : ''}`}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`${label} numeric value${unit ? ` in ${unit}` : ''}`}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          value={draft ?? value.toFixed(precision)}
          onFocus={(e) => {
            setDraft(value.toFixed(precision));
            e.target.select();
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(null);
              setError(null);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              // Fine adjustment directly in the numeric field.
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              const next = Math.min(max, Math.max(min, value + delta));
              setDraft(null);
              onChange(next);
            }
          }}
        />
      </div>
      {error && <InlineError>{error}</InlineError>}
      {note && !error && <InlineError>{note}</InlineError>}
    </div>
  );
}
