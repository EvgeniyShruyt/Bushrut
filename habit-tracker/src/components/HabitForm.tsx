import type { Habit } from '@prisma/client';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/date';
import {
  CATEGORY_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  TIME_OF_DAY,
  TIME_OF_DAY_LABELS,
  VISIBLE_WHEN_LABELS,
  parseDaysOfWeek,
} from '@/lib/domain/types';

/** Форма привычки: используется и для создания, и для редактирования. */
export function HabitForm({
  habit,
  action,
  submitLabel,
}: {
  habit?: Habit;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const days = habit ? parseDaysOfWeek(habit.daysOfWeek) : 'ALL';
  const isChecked = (day: string) => days === 'ALL' || days.includes(day as never);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor={`name-${habit?.id ?? 'new'}`}>
          Название
        </label>
        <input
          id={`name-${habit?.id ?? 'new'}`}
          name="name"
          defaultValue={habit?.name ?? ''}
          required
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Тип</label>
          <select name="type" defaultValue={habit?.type ?? 'POSITIVE'} className="field">
            <option value="POSITIVE">Привычка</option>
            <option value="BUDGET">Бюджет (антипривычка)</option>
          </select>
        </div>
        <div>
          <label className="label">Блок дня</label>
          <select name="timeOfDay" defaultValue={habit?.timeOfDay ?? 'MORNING'} className="field">
            {TIME_OF_DAY.map((t) => (
              <option key={t} value={t}>
                {TIME_OF_DAY_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Категория</label>
          <select name="category" defaultValue={habit?.category ?? 'body'} className="field">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Стат</label>
          <select name="statTarget" defaultValue={habit?.statTarget ?? 'health'} className="field">
            {STAT_KEYS.map((s) => (
              <option key={s} value={s}>
                {STAT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="label">Дни недели</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="cursor-pointer select-none rounded-lg border border-ink-line px-3 py-1.5 text-xs
                has-[:checked]:border-racing has-[:checked]:bg-racing/15 has-[:checked]:text-racing"
            >
              <input
                type="checkbox"
                name="daysOfWeek"
                value={day}
                defaultChecked={isChecked(day)}
                className="sr-only"
              />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">Все семь дней сохраняются как «каждый день».</p>
      </div>

      <div>
        <label className="label">Видимость по типу дня</label>
        <select name="visibleWhen" defaultValue={habit?.visibleWhen ?? 'ANY'} className="field">
          {Object.entries(VISIBLE_WHEN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">XP</label>
          <input
            name="xpValue"
            type="number"
            min={1}
            defaultValue={habit?.xpValue ?? 10}
            className="field tabular"
          />
        </div>
        <div>
          <label className="label">Топливо</label>
          <input
            name="currencyValue"
            type="number"
            min={0}
            defaultValue={habit?.currencyValue ?? 10}
            className="field tabular"
          />
        </div>
        <div>
          <label className="label">Лимит/нед.</label>
          <input
            name="weeklyBudget"
            type="number"
            min={0}
            defaultValue={habit?.weeklyBudget ?? ''}
            placeholder="—"
            className="field tabular"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <div>
          <label className="label">Единица бюджета</label>
          <input name="unitLabel" defaultValue={habit?.unitLabel ?? 'раз'} className="field" />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            name="dailyBinary"
            defaultChecked={habit?.dailyBinary ?? false}
            className="h-4 w-4 accent-racing"
          />
          Отмечать «да/нет» за день
        </label>
      </div>

      <button type="submit" className="btn-primary w-full">
        {submitLabel}
      </button>
    </form>
  );
}
