import { AppShell } from '@/components/AppShell';
import { FuelTank } from '@/components/FuelTank';
import { BudgetCounter } from '@/components/BudgetCounter';
import { getBudgetsView } from '@/lib/queries';
import { BUDGET_WEEK_BONUS_MULTIPLIER } from '@/lib/domain/rules';

export const dynamic = 'force-dynamic';

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export default async function BudgetsPage() {
  const { budgets, week } = await getBudgetsView();

  return (
    <AppShell title="Антипривычки" subtitle={`Неделя ${week} · бюджеты обнуляются в понедельник`}>
      {budgets.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-ink-muted">
          Антипривычек нет. Добавьте их в «Настройках» с типом «Бюджет».
        </p>
      ) : null}

      {budgets.map((b) => {
        const left = Math.max(0, b.weeklyBudget - b.used);
        const abstinence = b.weeklyBudget === 0;

        return (
          <section key={b.id} className="card space-y-3 p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold leading-snug">{b.name}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {abstinence ? (
                    <>
                      Полный отказ ·{' '}
                      <span className="text-electric">
                        <span className="tabular">{b.cleanDays}</span>{' '}
                        {plural(b.cleanDays, 'день', 'дня', 'дней')} без срыва
                      </span>
                    </>
                  ) : (
                    <>
                      Лимит <span className="tabular">{b.weeklyBudget}</span> в неделю ·{' '}
                      {b.unitLabel}
                    </>
                  )}
                </p>
              </div>
              <BudgetCounter
                habitId={b.id}
                todayUsed={b.todayUsed}
                dailyBinary={b.dailyBinary}
              />
            </header>

            <FuelTank used={b.used} limit={b.weeklyBudget} />

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>
                <span className="tabular">
                  {b.used}/{b.weeklyBudget}
                </span>{' '}
                за неделю ·{' '}
                {left > 0 ? (
                  <>
                    осталось <span className="tabular">{left}</span>
                  </>
                ) : b.used === b.weeklyBudget ? (
                  'бак пуст'
                ) : (
                  <>
                    сверх лимита <span className="tabular">{b.used - b.weeklyBudget}</span>
                  </>
                )}
              </span>
              <span>
                сброс через <span className="tabular">{b.daysLeft}</span>{' '}
                {plural(b.daysLeft, 'день', 'дня', 'дней')}
              </span>
            </div>

            {b.used <= b.weeklyBudget ? (
              <p className="rounded-xl bg-electric/10 px-3 py-2 text-xs text-electric">
                Неделя в рамках бюджета — в понедельник начислится бонус.
              </p>
            ) : (
              <p className="rounded-xl bg-ink px-3 py-2 text-xs text-ink-muted">
                Бонус за эту неделю не начислится. Штрафа нет — просто следующая неделя с чистого
                листа.
              </p>
            )}

            {b.history.length > 0 ? (
              <details className="text-xs text-ink-muted">
                <summary className="cursor-pointer select-none py-1">История недель</summary>
                <ul className="mt-1 space-y-1">
                  {b.history.map((h) => (
                    <li key={h.week} className="flex items-center justify-between gap-2">
                      <span className="tabular">{h.week}</span>
                      <span className="tabular">
                        {h.used}/{h.limit}
                      </span>
                      <span className={h.withinBudget ? 'text-electric' : 'text-ink-muted'}>
                        {h.withinBudget ? `+${h.bonusPaid} ⛽` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        );
      })}

      {budgets.length > 0 ? (
        <p className="px-1 text-xs text-ink-muted">
          Бонус за чистую неделю — ×{BUDGET_WEEK_BONUS_MULTIPLIER} от стоимости привычки. Начисляется
          лениво: при первом заходе в приложение на новой неделе.
        </p>
      ) : null}
    </AppShell>
  );
}
