'use client';

import { useTransition } from 'react';
import { bumpBudget } from '@/app/actions';

/** Отметка расхода бюджета за сегодня на экране антипривычек. */
export function BudgetCounter({
  habitId,
  todayUsed,
  dailyBinary,
}: {
  habitId: string;
  todayUsed: number;
  dailyBinary: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function change(delta: number) {
    startTransition(() => bumpBudget(habitId, delta));
  }

  if (dailyBinary) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => change(todayUsed > 0 ? -todayUsed : 1)}
        className={`chip shrink-0 border ${
          todayUsed > 0
            ? 'border-signal-hold/50 bg-signal-hold/10 text-signal-hold'
            : 'border-ink-line text-ink-muted'
        } ${pending ? 'opacity-60' : ''}`}
      >
        {todayUsed > 0 ? 'Сегодня было' : 'Сегодня чисто'}
      </button>
    );
  }

  return (
    <div className={`flex shrink-0 items-center gap-1 ${pending ? 'opacity-60' : ''}`}>
      <button
        type="button"
        aria-label="Убавить за сегодня"
        disabled={pending || todayUsed === 0}
        onClick={() => change(-1)}
        className="h-9 w-9 rounded-xl border border-ink-line text-lg leading-none disabled:opacity-30"
      >
        −
      </button>
      <span className="tabular w-6 text-center text-sm">{todayUsed}</span>
      <button
        type="button"
        aria-label="Добавить за сегодня"
        disabled={pending}
        onClick={() => change(1)}
        className="h-9 w-9 rounded-xl border border-ink-line text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}
