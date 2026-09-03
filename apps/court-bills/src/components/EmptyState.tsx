import type { ReactNode } from 'react';

export function EmptyState({ icon, title, body, actions }: { icon?: ReactNode; title: string; body?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-4xl">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
}
