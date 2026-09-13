import type { DaySummary } from '@/lib/domain/history';
import { WEEKDAY_LABELS, WEEKDAYS, weekdayOf } from '@/lib/date';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function cellClass(day: DaySummary): string {
  if (day.pitStops > 0 && day.ratio < 1) return 'bg-signal-hold/60';
  if (day.ratio === -1) return 'bg-ink-line/40';
  if (day.ratio === 0) return 'bg-ink-line';
  if (day.ratio < 0.5) return 'bg-racing/30';
  if (day.ratio < 1) return 'bg-racing/60';
  return 'bg-racing';
}

/** Тепловая карта календаря (раздел 6.4 ТЗ): недели — колонки, дни — строки. */
export function Heatmap({ history }: { history: DaySummary[] }) {
  if (history.length === 0) return null;

  // Дополняем начало пустыми клетками, чтобы первая колонка начиналась с понедельника.
  const leading = WEEKDAYS.indexOf(weekdayOf(history[0].date));
  const cells: (DaySummary | null)[] = [...Array(leading).fill(null), ...history];
  const columns: (DaySummary | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        <div className="mr-1 flex shrink-0 flex-col gap-[3px] pt-[14px]">
          {WEEKDAYS.map((d, i) => (
            <span
              key={d}
              className="h-[11px] text-[9px] leading-[11px] text-ink-muted"
              style={{ visibility: i % 2 === 0 ? 'visible' : 'hidden' }}
            >
              {WEEKDAY_LABELS[d]}
            </span>
          ))}
        </div>

        {columns.map((column, ci) => {
          const first = column.find(Boolean);
          const showMonth =
            first && Number(first.date.slice(8, 10)) <= 7 ? MONTHS[Number(first.date.slice(5, 7)) - 1] : '';
          return (
            <div key={ci} className="flex shrink-0 flex-col gap-[3px]">
              <span className="h-[11px] text-[9px] leading-[11px] text-ink-muted">{showMonth}</span>
              {Array.from({ length: 7 }, (_, ri) => {
                const day = column[ri];
                if (!day) return <span key={ri} className="h-[11px] w-[11px]" />;
                return (
                  <span
                    key={ri}
                    title={`${day.date}: ${day.completed}/${day.required}${
                      day.pitStops > 0 ? ' · пит-стоп' : ''
                    }`}
                    className={`h-[11px] w-[11px] rounded-[2px] ${cellClass(day)}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-ink-muted">
        <span>меньше</span>
        <span className="h-[10px] w-[10px] rounded-[2px] bg-ink-line" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-racing/30" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-racing/60" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-racing" />
        <span>больше</span>
        <span className="ml-2 h-[10px] w-[10px] rounded-[2px] bg-signal-hold/60" />
        <span>пит-стоп</span>
      </div>
    </div>
  );
}
