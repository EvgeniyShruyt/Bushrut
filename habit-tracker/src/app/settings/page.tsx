import { AppShell } from '@/components/AppShell';
import { HabitForm } from '@/components/HabitForm';
import { ActionButton } from '@/components/ActionButton';
import { DangerButton } from '@/components/DangerButton';
import { PushToggle } from '@/components/PushToggle';
import {
  createHabit,
  createScheduleBlock,
  deleteHabit,
  deleteScheduleBlock,
  reorderHabit,
  setHabitActive,
  signOut,
  updateHabit,
} from '@/app/actions';
import { getSettingsView } from '@/lib/queries';
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '@/lib/date';
import { TIME_OF_DAY_LABELS, type TimeOfDay } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { habits, blocks } = await getSettingsView();

  return (
    <AppShell title="Настройки" subtitle="Привычки, лимиты, расписание">
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Привычки
        </h2>

        {habits.map((habit, index) => (
          <details key={habit.id} className={`card p-4 ${habit.active ? '' : 'opacity-60'}`}>
            <summary className="flex cursor-pointer select-none items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{habit.name}</span>
                <span className="mt-0.5 block text-[11px] text-ink-muted">
                  {TIME_OF_DAY_LABELS[habit.timeOfDay as TimeOfDay]} ·{' '}
                  {habit.type === 'BUDGET' ? `лимит ${habit.weeklyBudget ?? 0}/нед.` : `${habit.xpValue} XP`}
                  {habit.active ? '' : ' · в архиве'}
                </span>
              </span>

              <ActionButton
                action={reorderHabit.bind(null, habit.id, 'up')}
                title="Выше"
                className="px-1.5 text-ink-muted"
              >
                ↑
              </ActionButton>
              <ActionButton
                action={reorderHabit.bind(null, habit.id, 'down')}
                title="Ниже"
                className="px-1.5 text-ink-muted"
              >
                ↓
              </ActionButton>
            </summary>

            <div className="mt-4 border-t border-ink-line pt-4">
              <HabitForm
                habit={habit}
                action={updateHabit.bind(null, habit.id)}
                submitLabel="Сохранить"
              />

              <div className="mt-3 flex items-center justify-between">
                <ActionButton
                  action={setHabitActive.bind(null, habit.id, !habit.active)}
                  className="text-xs text-electric underline-offset-2 hover:underline"
                >
                  {habit.active ? 'В архив' : 'Вернуть из архива'}
                </ActionButton>

                <DangerButton
                  action={deleteHabit.bind(null, habit.id)}
                  confirmText={`Удалить «${habit.name}» вместе со всей историей отметок? Начисленные за неё XP и топливо будут пересчитаны.`}
                >
                  Удалить навсегда
                </DangerButton>
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                Архив сохраняет историю и убирает привычку из ленты дня — в большинстве случаев нужен
                именно он.
              </p>
            </div>
            <span className="sr-only">{index}</span>
          </details>
        ))}

        <details className="card p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-electric">
            + Новая привычка
          </summary>
          <div className="mt-4 border-t border-ink-line pt-4">
            <HabitForm action={createHabit} submitLabel="Создать" />
          </div>
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Блоки расписания
        </h2>
        <p className="px-1 text-[11px] text-ink-muted">
          Информационные блоки в ленте дня — не отмечаются, просто показывают занятое время.
        </p>

        {blocks.length > 0 ? (
          <ul className="card divide-y divide-ink-line px-4">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="tabular w-8 shrink-0 text-xs text-electric">
                  {WEEKDAY_LABELS[b.dayOfWeek as Weekday] ?? b.dayOfWeek}
                </span>
                <span className="tabular shrink-0 text-xs text-ink-muted">
                  {b.startTime}–{b.endTime}
                </span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <DangerButton
                  action={deleteScheduleBlock.bind(null, b.id)}
                  confirmText={`Удалить блок «${b.name}»?`}
                  className="shrink-0"
                >
                  Удалить
                </DangerButton>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="card p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-electric">
            + Новый блок
          </summary>
          <form action={createScheduleBlock} className="mt-4 space-y-3 border-t border-ink-line pt-4">
            <div>
              <label className="label" htmlFor="block-name">
                Название
              </label>
              <input id="block-name" name="name" required className="field" />
            </div>
            <div>
              <span className="label">Дни</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="cursor-pointer select-none rounded-lg border border-ink-line px-3 py-1.5 text-xs
                      has-[:checked]:border-racing has-[:checked]:bg-racing/15 has-[:checked]:text-racing"
                  >
                    <input type="checkbox" name="dayOfWeek" value={day} className="sr-only" />
                    {WEEKDAY_LABELS[day]}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="block-start">
                  Начало
                </label>
                <input id="block-start" name="startTime" type="time" required className="field tabular" />
              </div>
              <div>
                <label className="label" htmlFor="block-end">
                  Конец
                </label>
                <input id="block-end" name="endTime" type="time" required className="field tabular" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">
              Добавить
            </button>
          </form>
        </details>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Вечернее напоминание
        </h2>
        <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
      </section>

      <section className="card p-4">
        <form action={signOut}>
          <button type="submit" className="btn-ghost w-full">
            Выйти
          </button>
        </form>
      </section>
    </AppShell>
  );
}
