import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';

/* ---------- Panel ---------- */

export function Panel({
  title,
  icon,
  children,
  className = '',
  actions,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-title">
          {icon}
          <span style={{ flex: 1 }}>{title}</span>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Accordion ---------- */

export function Accordion({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="accordion">
      <button
        type="button"
        className="accordion-header"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {badge}
        </span>
        <ChevronDown
          size={16}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.18s ease',
            flex: 'none',
          }}
        />
      </button>
      {open && (
        <div className="accordion-body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        tabIndex={-1}
        ref={ref}
      >
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3>{title}</h3>
          <button type="button" className="btn ghost sm icon-only" onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>
        {children}
        {footer && <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'ok' | 'error';
}

interface ToastContextValue {
  push: (message: string, kind?: Toast['kind']) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'error' && <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ---------- Misc ---------- */

export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <span className="field-error" role="alert">
      <AlertTriangle size={12} /> {children}
    </span>
  );
}

export function Callout({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'error' | 'ok';
  children: ReactNode;
}) {
  return <div className={`callout ${kind === 'info' ? '' : kind}`}>{children}</div>;
}
