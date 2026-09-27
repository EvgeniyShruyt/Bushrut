import webpush from 'web-push';
import { prisma } from '@/lib/db';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:me@example.com',
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export async function sendToAll(payload: { title: string; body: string }): Promise<number> {
  if (!configure()) throw new Error('VAPID-ключи не заданы: выполните npm run gen:vapid');

  const subscriptions = await prisma.pushSubscription.findMany();
  let delivered = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      // Подписка отозвана браузером — чистим, чтобы не копить мусор.
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
      }
    }
  }

  return delivered;
}
