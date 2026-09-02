import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Bottom sheet on phones, centred dialog from md up.
 * Used to move the rarely-touched controls off the main session screen.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl outline-none',
          'md:max-h-[85vh] md:max-w-lg md:rounded-2xl',
        )}
      >
        <div className="shrink-0 px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-semibold">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
            </div>
            <button className="btn btn-ghost btn-sm -mr-2 shrink-0" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
      </div>
    </div>
  );
}
