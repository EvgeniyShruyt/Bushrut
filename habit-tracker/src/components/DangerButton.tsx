'use client';

import { useTransition } from 'react';

/** Кнопка необратимого действия: спрашивает подтверждение перед вызовом. */
export function DangerButton({
  action,
  confirmText,
  children,
  className = '',
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) startTransition(() => action());
      }}
      className={`text-xs text-racing underline-offset-2 hover:underline disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
