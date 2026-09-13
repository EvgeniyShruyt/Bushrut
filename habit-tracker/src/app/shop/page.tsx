import { AppShell } from '@/components/AppShell';
import { RewardRow } from '@/components/ShopClient';
import { createReward } from '@/app/actions';
import { getShopView } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { balance, rewards, purchases } = await getShopView();

  return (
    <AppShell title="Магазин" subtitle="Топливо тратится на то, что вы сами назначили наградой">
      <section className="card flex items-center justify-between p-4">
        <span className="text-sm text-ink-muted">Баланс</span>
        <span className="tabular text-3xl font-bold text-electric">⛽ {balance}</span>
      </section>

      <section className="space-y-2">
        {rewards.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-ink-muted">
            Наград пока нет — создайте первую ниже.
          </p>
        ) : (
          rewards.map((r) => (
            <RewardRow
              key={r.id}
              reward={{ id: r.id, name: r.name, cost: r.cost, emoji: r.emoji }}
              balance={balance}
            />
          ))
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Новая награда
        </h2>
        <form action={createReward} className="space-y-3">
          <div className="flex gap-2">
            <input
              name="emoji"
              defaultValue="🎁"
              maxLength={4}
              aria-label="Эмодзи"
              className="field w-16 text-center text-lg"
            />
            <input name="name" placeholder="Например, вечер настолок" required className="field flex-1" />
          </div>
          <div className="flex gap-2">
            <input
              name="cost"
              type="number"
              min={1}
              step={1}
              defaultValue={200}
              required
              aria-label="Цена в топливе"
              className="field tabular flex-1"
            />
            <button type="submit" className="btn-primary shrink-0">
              Добавить
            </button>
          </div>
        </form>
      </section>

      {purchases.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            История покупок
          </h2>
          <ul className="divide-y divide-ink-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span aria-hidden>{p.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="tabular shrink-0 text-xs text-ink-muted">
                  {new Date(p.purchasedAt).toLocaleDateString('ru-RU')}
                </span>
                <span className="tabular shrink-0 text-xs text-racing">−{p.costPaid}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
