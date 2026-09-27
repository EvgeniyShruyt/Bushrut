'use client';

import { useRef, useState, useTransition } from 'react';
import { bumpBudget, toggleHabit } from '@/app/actions';
import type { TodayHabit } from '@/lib/queries';

const SWIPE_THRESHOLD = 72;

/**
 * Карточка привычки. Отметить можно тапом или свайпом вправо (раздел 6 ТЗ).
 * Состояние оптимистичное — ответ сервера не ждём, чтобы отметка была мгновенной.
 */
export function HabitCard({ habit }: { habit: TodayHabit }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(habit.completed);
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);

  const done = pending ? optimistic : habit.completed;

  function commit(next: boolean) {
    setOptimistic(next);
    startTransition(() => toggleHabit(habit.id, next));
  }

  function onTouchStart(event: React.TouchEvent) {
    startX.current = event.touches[0].clientX;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (startX.current === null) return;
    const delta = event.touches[0].clientX - startX.current;
    // Свайп вправо отмечает, влево — снимает отметку.
    setOffset(Math.max(-120, Math.min(120, delta)));
  }

  function onTouchEnd() {
    if (Math.abs(offset) >= SWIPE_THRESHOLD) commit(offset > 0);
    setOffset(0);
    startX.current = null;
  }

  if (habit.type === 'BUDGET') return <BudgetCard habit={habit} />;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center px-5 text-sm font-semibold ${
          offset >= 0 ? 'justify-start text-signal-go' : 'justify-end text-ink-muted'
        }`}
      >
        {offset >= 0 ? '✓ Выполнено' : 'Снять отметку'}
      </div>

      <button
        type="button"
        onClick={() => commit(!done)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-pressed={done}
        className={`card relative flex w-full items-center gap-3 p-4 text-left transition-transform ${
          done ? 'border-signal-go/40' : ''
        } ${pending ? 'opacity-70' : ''}`}
        style={{ transform: `translateX(${offset}px)`, transitionDuration: offset ? '0ms' : '180ms' }}
      >
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
            done ? 'border-signal-go bg-signal-go text-ink' : 'border-ink-line text-transparent'
          }`}
        >
          ✓
        </span>

        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${done ? 'text-ink-muted line-through' : ''}`}>
            {habit.name}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
            <span className="tabular text-electric">+{habit.xpValue} XP</span>
            <span className="tabular">⛽ {habit.currencyValue}</span>
            {habit.currentStreak > 0 ? (
              <span className="tabular text-racing">🔥 {habit.currentStreak}</span>
            ) : null}
            {habit.pitStopUsed ? <span className="text-signal-hold">🔧 пит-стоп</span> : null}
          </span>
        </span>
      </button>
    </div>
  );
}

/** Антипривычка в ленте дня: счётчик расхода недельного бюджета. */
function BudgetCard({ habit }: { habit: TodayHabit }) {
  const [pending, startTransition] = useTransition();
  const limit = habit.weeklyBudget ?? 0;
  const over = habit.weekUsed > limit;

  function change(delta: number) {
    startTransition(() => bumpBudget(habit.id, delta));
  }

  return (
    <div className={`card flex items-center gap-3 p-4 ${pending ? 'opacity-70' : ''}`}>
      <span aria-hidden className="text-lg">
        ⛽
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{habit.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {limit === 0 ? (
            <>
              Полный отказ ·{' '}
              <span className={over ? 'text-signal-hold' : 'text-electric'}>
                {over ? (
                  <>
                    срывов за неделю: <span className="tabular">{habit.weekUsed}</span>
                  </>
                ) : (
                  'неделя чистая'
                )}
              </span>
            </>
          ) : (
            <>
              <span className={`tabular ${over ? 'text-signal-hold' : 'text-electric'}`}>
                {habit.weekUsed}/{limit}
              </span>{' '}
              за неделю · {habit.unitLabel}
            </>
          )}
        </p>
      </div>

      {habit.dailyBinary ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => change(habit.budgetUsed > 0 ? -habit.budgetUsed : 1)}
          className={`chip shrink-0 border ${
            habit.budgetUsed > 0
              ? 'border-signal-hold/50 bg-signal-hold/10 text-signal-hold'
              : 'border-ink-line text-ink-muted'
          }`}
        >
          {habit.budgetUsed > 0 ? 'Был' : 'Не было'}
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Убавить"
            disabled={pending || habit.budgetUsed === 0}
            onClick={() => change(-1)}
            className="h-9 w-9 rounded-xl border border-ink-line text-lg leading-none disabled:opacity-30"
          >
            −
          </button>
          <span className="tabular w-6 text-center text-sm">{habit.budgetUsed}</span>
          <button
            type="button"
            aria-label="Добавить"
            disabled={pending}
            onClick={() => change(1)}
            className="h-9 w-9 rounded-xl border border-ink-line text-lg leading-none"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
