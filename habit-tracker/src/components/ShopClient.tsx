'use client';

import { useState, useTransition } from 'react';
import { deleteReward, purchaseReward } from '@/app/actions';

type Reward = { id: string; name: string; cost: number; emoji: string };

export function RewardRow({ reward, balance }: { reward: Reward; balance: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const affordable = balance >= reward.cost;

  function buy() {
    setError(null);
    startTransition(async () => {
      const result = await purchaseReward(reward.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <article className={`card p-4 ${pending ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {reward.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{reward.name}</p>
          <p className="tabular mt-0.5 text-xs text-electric">⛽ {reward.cost}</p>
        </div>

        <button
          type="button"
          onClick={buy}
          disabled={pending || !affordable}
          className={affordable ? 'btn-primary shrink-0' : 'btn-ghost shrink-0'}
        >
          {affordable ? 'Купить' : 'Копим'}
        </button>
      </div>

      {!affordable ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-electric/60"
              style={{ width: `${Math.round((balance / reward.cost) * 100)}%` }}
            />
          </div>
          <p className="tabular mt-1 text-[10px] text-ink-muted">
            не хватает {reward.cost - balance}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-racing">{error}</p> : null}

      <button
        type="button"
        onClick={() => startTransition(() => deleteReward(reward.id))}
        className="mt-2 text-[11px] text-ink-muted underline-offset-2 hover:underline"
      >
        Убрать из магазина
      </button>
    </article>
  );
}
