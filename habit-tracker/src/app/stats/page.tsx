import { AppShell } from '@/components/AppShell';
import { ProgressRing } from '@/components/ProgressRing';
import { StatRadar } from '@/components/StatRadar';
import { getStatsView } from '@/lib/queries';
import { STAT_KEYS, STAT_LABELS } from '@/lib/domain/types';
import { PIT_STOP_EARN_DAYS } from '@/lib/domain/rules';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const { stats, level, streaks } = await getStatsView();
  const radar = STAT_KEYS.map((key) => ({ stat: STAT_LABELS[key], value: stats[key] }));

  return (
    <AppShell title="Статы" subtitle="Баланс по пяти направлениям">
      <section className="card flex items-center gap-4 p-4">
        <ProgressRing progress={level.progress} size={84} color="#00D4FF">
          <span className="tabular text-xl font-bold leading-none">{level.level}</span>
          <span className="text-[10px] uppercase text-ink-muted">ур.</span>
        </ProgressRing>
        <dl className="grid flex-1 grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-muted">Всего XP</dt>
          <dd className="tabular text-right font-semibold">{stats.xpTotal}</dd>
          <dt className="text-ink-muted">До уровня {level.level + 1}</dt>
          <dd className="tabular text-right font-semibold">
            {level.xpForNextLevel - level.xpIntoLevel}
          </dd>
          <dt className="text-ink-muted">Топливо</dt>
          <dd className="tabular text-right font-semibold text-electric">{stats.currencyBalance}</dd>
        </dl>
      </section>

      <section className="card p-2">
        <StatRadar data={radar} />
        <ul className="grid grid-cols-5 gap-1 px-2 pb-2">
          {STAT_KEYS.map((key) => (
            <li key={key} className="text-center">
              <div className="tabular text-sm font-semibold">{stats[key]}</div>
              <div className="truncate text-[10px] text-ink-muted">{STAT_LABELS[key]}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Стрики и пит-стопы
        </h2>
        {streaks.length === 0 ? (
          <p className="px-1 text-sm text-ink-muted">Пока нет данных.</p>
        ) : (
          streaks.map((s) => (
            <div key={s.habitId} className="card flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  рекорд <span className="tabular">{s.longestStreak}</span> · до пит-стопа{' '}
                  <span className="tabular">{PIT_STOP_EARN_DAYS - s.daysTowardsPitStop}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular text-lg font-bold text-racing">🔥 {s.currentStreak}</div>
                <div className="tabular text-xs text-ink-muted">🔧 {s.pitStopsAvailable}</div>
              </div>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
