import { AppShell } from '@/components/AppShell';
import { DayTypeSwitch } from '@/components/DayTypeSwitch';
import { HabitCard } from '@/components/HabitCard';
import { ProgressRing } from '@/components/ProgressRing';
import { getTodayView } from '@/lib/queries';
import { humanDate } from '@/lib/date';
import { TIME_OF_DAY_LABELS, type TimeOfDay } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

/** Информационный блок расписания попадает в тот блок дня, куда попадает его время. */
function blockOf(startTime: string): TimeOfDay {
  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return 'MORNING';
  if (hour < 17) return 'AFTERNOON';
  return 'EVENING';
}

export default async function TodayPage() {
  const view = await getTodayView();
  const ratio = view.totalRequired === 0 ? 1 : view.totalCompleted / view.totalRequired;

  return (
    <AppShell title="Сегодня" subtitle={humanDate(view.date)}>
      <section className="card flex items-center gap-4 p-4">
        <ProgressRing progress={ratio} size={92} color="#E10600">
          <span className="tabular text-xl font-bold leading-none">{view.totalCompleted}</span>
          <span className="tabular text-[11px] text-ink-muted">из {view.totalRequired}</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-ink-muted">Уровень</span>
            <span className="tabular text-2xl font-bold text-electric">{view.level.level}</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-electric transition-all duration-500"
              style={{ width: `${Math.round(view.level.progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="tabular">
              {view.level.xpIntoLevel}/{view.level.xpForNextLevel}
            </span>{' '}
            XP до уровня <span className="tabular">{view.level.level + 1}</span>
          </p>

          <p className="mt-2 flex items-center gap-3 text-xs">
            <span className="tabular text-ink-muted">⛽ {view.stats.currencyBalance}</span>
            <span className="tabular text-ink-muted">🔧 {view.pitStopsTotal}</span>
          </p>
        </div>
      </section>

      <DayTypeSwitch value={view.dayType} />

      {view.blocks.map(({ block, habits }) => {
        const schedule = view.scheduleBlocks.filter((b) => blockOf(b.startTime) === block);
        if (habits.length === 0 && schedule.length === 0) return null;

        const done = habits.filter((h) => h.type === 'POSITIVE' && h.completed).length;
        const total = habits.filter((h) => h.type === 'POSITIVE').length;

        return (
          <section key={block} className="space-y-2">
            <h2 className="flex items-baseline justify-between px-1">
              <span className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {TIME_OF_DAY_LABELS[block]}
              </span>
              {total > 0 ? (
                <span className="tabular text-xs text-ink-muted">
                  {done}/{total}
                </span>
              ) : null}
            </h2>

            {schedule.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-line px-4 py-2.5 text-sm text-ink-muted"
              >
                <span className="tabular shrink-0 text-xs text-electric">
                  {b.startTime}–{b.endTime}
                </span>
                <span className="truncate">{b.name}</span>
              </div>
            ))}

            {habits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </section>
        );
      })}

      {view.totalRequired === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-ink-muted">
          На сегодня привычек нет. Добавьте их в «Настройках».
        </p>
      ) : null}
    </AppShell>
  );
}
