import { AppShell } from '@/components/AppShell';
import { Heatmap } from '@/components/Heatmap';
import { getTrophiesView } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function TrophiesPage() {
  const { achievements, history } = await getTrophiesView();
  const unlocked = achievements.filter((a) => a.unlockedAt).length;

  return (
    <AppShell title="Трофеи" subtitle={`Открыто ${unlocked} из ${achievements.length}`}>
      <section className="grid grid-cols-2 gap-2">
        {achievements.map((a) => {
          const done = Boolean(a.unlockedAt);
          return (
            <article
              key={a.code}
              className={`card flex flex-col gap-1.5 p-3.5 ${done ? 'border-racing/40' : ''}`}
            >
              <span className={`text-2xl ${done ? '' : 'opacity-25 grayscale'}`} aria-hidden>
                {a.emoji}
              </span>
              <h3 className={`text-sm font-semibold ${done ? '' : 'text-ink-muted'}`}>{a.title}</h3>
              <p className="text-[11px] leading-snug text-ink-muted">{a.description}</p>

              {done ? (
                <p className="tabular mt-auto pt-1 text-[10px] text-racing">
                  {new Date(a.unlockedAt!).toLocaleDateString('ru-RU')}
                </p>
              ) : (
                <div className="mt-auto pt-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                    <div
                      className="h-full rounded-full bg-electric/60"
                      style={{ width: `${Math.round((a.progress / a.target) * 100)}%` }}
                    />
                  </div>
                  <p className="tabular mt-1 text-[10px] text-ink-muted">
                    {a.progress} / {a.target}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Календарь полугодия
        </h2>
        <Heatmap history={history} />
      </section>
    </AppShell>
  );
}
