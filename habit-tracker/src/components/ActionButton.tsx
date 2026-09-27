'use client';

import { useTransition } from 'react';

/** Маленькая кнопка, вызывающая server action без формы. */
export function ActionButton({
  action,
  children,
  className = '',
  title,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={() => startTransition(() => action())}
      className={`${className} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
