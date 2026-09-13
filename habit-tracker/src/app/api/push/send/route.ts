import { NextResponse } from 'next/server';
import { getTodayView } from '@/lib/queries';
import { sendToAll } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Вечернее напоминание о невыполненных привычках (раздел 2 ТЗ).
 *
 * Эндпоинт не защищён паскодом (его дёргает внешний планировщик), поэтому
 * требует заголовок с PUSH_CRON_SECRET. Планировщик — любой: cron хостинга,
 * systemd-таймер, «Ярлыки» на телефоне. Своего воркера приложение не поднимает.
 */
export async function POST(request: Request) {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'PUSH_CRON_SECRET не задан' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 401 });
  }

  const view = await getTodayView();
  const left = view.totalRequired - view.totalCompleted;

  if (left === 0) {
    return NextResponse.json({ ok: true, skipped: 'всё закрыто' });
  }

  const names = view.blocks
    .flatMap((b) => b.habits)
    .filter((h) => h.type === 'POSITIVE' && !h.completed)
    .map((h) => h.name)
    .slice(0, 3)
    .join(', ');

  const delivered = await sendToAll({
    title: `Осталось ${left} до конца круга`,
    body: names,
  });

  return NextResponse.json({ ok: true, delivered, left });
}
