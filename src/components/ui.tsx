import { LoaderCircle, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { useStore } from '../state/store';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------- buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-[0.96] active:brightness-90 font-semibold',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'text-neg border border-neg/30 hover:bg-neg/10',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------- layout ----------

export function Card({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface shadow-card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'pos' | 'neg' | 'warn' | 'accent' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    pos: 'bg-pos/10 text-pos',
    neg: 'bg-neg/10 text-neg',
    warn: 'bg-warn/15 text-warn',
    accent: 'bg-accent/15 text-accent-ink',
  } as const;
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('h-4 w-4 animate-spin', className)} />;
}

// ---------- form controls ----------

const CONTROL =
  'rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60';

/** Full width unless the caller sets its own width (w-40, w-auto…). */
const width = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? '' : 'w-full');

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const t = useT();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="ms-1 font-normal text-muted">({t.common.optional})</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-neg">{error}</p> : hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(CONTROL, 'h-9', width(className), className)} />;
}

/** Text box for numbers; accepts Arabic digits. */
export function NumberInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      dir="ltr"
      {...rest}
      className={cx(CONTROL, 'tnum h-9 text-start', width(className), className)}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(CONTROL, 'h-9 cursor-pointer pe-8', width(className), className)}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...rest} className={cx(CONTROL, 'py-2', width(className), className)} />;
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-line accent-[rgb(var(--accent))]"
      />
      {label}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
            o.value === value ? 'bg-surface font-medium text-ink shadow-card' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- modal ----------

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button[data-autofocus]');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[7vh]" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('w-full rounded-2xl border border-line bg-surface shadow-pop', wide ? 'max-w-2xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label={t.common.close} onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({
  open,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  danger = true,
}: {
  open: boolean;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  danger?: boolean;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      title={confirmLabel}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            data-autofocus
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-2">{message}</p>
    </Modal>
  );
}

// ---------- toasts ----------

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          className={cx(
            'pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-pop',
            x.kind === 'error' ? 'border-neg/40 bg-surface text-neg' : 'border-line bg-surface text-ink',
          )}
        >
          {x.text}
        </div>
      ))}
    </div>
  );
}
