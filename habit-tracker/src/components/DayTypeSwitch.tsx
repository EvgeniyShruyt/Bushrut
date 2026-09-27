'use client';

import { useTransition } from 'react';
import { setDayType } from '@/app/actions';
import { DAY_TYPES, DAY_TYPE_LABELS, type DayType } from '@/lib/domain/types';

/**
 * Тип дня выбирается вручную каждое утро (раздел 5 ТЗ): офисные дни не
 * привязаны к дню недели, автоопределение не подошло бы.
 */
export function DayTypeSwitch({ value }: { value: DayType }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="Тип дня"
      className={`flex gap-1 rounded-2xl border border-ink-line bg-ink-soft p-1 ${
        pending ? 'opacity-60' : ''
      }`}
    >
      {DAY_TYPES.map((type) => {
        const active = type === value;
        return (
          <button
            key={type}
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => startTransition(() => setDayType(type))}
            className={`chip flex-1 ${
              active ? 'bg-racing text-white' : 'text-ink-muted hover:text-white'
            }`}
          >
            {DAY_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}
