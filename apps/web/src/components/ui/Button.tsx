import type { ComponentProps } from 'react';

export function Button({ className = '', type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={`rounded-lg border border-border bg-primary px-3 py-2 font-medium text-primary-foreground transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${className}`}
      {...props}
    />
  );
}
