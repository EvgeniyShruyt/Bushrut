/** Печатает пару VAPID-ключей для .env. Запуск: npm run gen:vapid */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Скопируйте в .env:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
