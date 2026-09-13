'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = 'loading' | 'unsupported' | 'no-key' | 'off' | 'on' | 'denied';

/** Подписка на вечернее напоминание. Регистрирует сервис-воркер при включении. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (!publicKey) {
      setState('no-key');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [publicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error('Сервер отклонил подписку');

      setState('on');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подписаться');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('off');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отписаться');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <p className="text-sm text-ink-muted">Проверяем…</p>;

  if (state === 'unsupported') {
    return (
      <p className="text-sm text-ink-muted">
        Браузер не поддерживает push. На iOS сначала добавьте приложение на домашний экран.
      </p>
    );
  }

  if (state === 'no-key') {
    return (
      <p className="text-sm text-ink-muted">
        Не заданы VAPID-ключи. Выполните <code className="font-mono text-electric">npm run gen:vapid</code>{' '}
        и перезапустите приложение.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p className="text-sm text-ink-muted">
        Уведомления запрещены в настройках браузера — включите их там и вернитесь сюда.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={state === 'on' ? disable : enable}
        className={state === 'on' ? 'btn-ghost w-full' : 'btn-primary w-full'}
      >
        {busy ? 'Секунду…' : state === 'on' ? 'Отключить напоминание' : 'Включить напоминание'}
      </button>
      <p className="text-[11px] text-ink-muted">
        Само время отправки задаёт внешний планировщик — он дёргает{' '}
        <code className="font-mono">POST /api/push/send</code>. Приложение фоновых воркеров не
        поднимает.
      </p>
      {error ? <p className="text-xs text-racing">{error}</p> : null}
    </div>
  );
}
