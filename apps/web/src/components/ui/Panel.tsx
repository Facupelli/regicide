import type { ComponentProps } from 'react';

export function Panel({ className = '', ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={`rounded-xl border border-border bg-panel p-3 sm:p-4 ${className}`}
      {...props}
    />
  );
}

export function PanelTitle({ className = '', ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={`text-xs font-semibold tracking-wider text-muted-foreground uppercase ${className}`}
      {...props}
    />
  );
}
