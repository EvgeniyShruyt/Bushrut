'use client';

import { useEffect } from 'react';

/** Регистрирует сервис-воркер, чтобы приложение ставилось на домашний экран. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* офлайн-режим не критичен для работы приложения */
    });
  }, []);

  return null;
}
