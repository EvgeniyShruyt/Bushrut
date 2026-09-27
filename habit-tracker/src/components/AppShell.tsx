import Link from 'next/link';
import { BottomNav } from './BottomNav';

/** Общая обёртка экранов: заголовок, контент, нижняя навигация. */
export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Link
            href="/settings"
            aria-label="Настройки"
            className="rounded-xl border border-ink-line bg-ink-soft px-3 py-2 text-base leading-none"
          >
            ⚙️
          </Link>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}
