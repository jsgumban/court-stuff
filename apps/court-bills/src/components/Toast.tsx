import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';

type Kind = 'ok' | 'error';
interface ToastApi {
  show: (message: string, kind?: Kind) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: Kind; id: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, kind: Kind = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
        {toast && (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg border',
              toast.kind === 'ok' ? 'bg-ink text-surface border-ink' : 'bg-bad-soft text-bad border-bad/30',
            )}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
