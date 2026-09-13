/**
 * Passcode-защита вместо полноценной аутентификации (раздел 2 ТЗ).
 * Приложение однопользовательское, но cookie подписывается HMAC, чтобы её
 * нельзя было подделать простым редактированием в devtools.
 *
 * Используется Web Crypto — модуль работает и в Edge-рантайме middleware.
 */

export const SESSION_COOKIE = 'ht_session';
const SESSION_TTL_DAYS = 180;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
  return value;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

/** Сравнение за постоянное время — чтобы не сливать код по таймингу. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_DAYS * 86_400_000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!timingSafeEqual(signature, await hmac(payload))) return false;
  return Number(payload) > Date.now();
}

export function checkPasscode(input: string): boolean {
  const expected = requiredEnv('APP_PASSCODE');
  return timingSafeEqual(input, expected);
}

export const SESSION_MAX_AGE = SESSION_TTL_DAYS * 86_400;
