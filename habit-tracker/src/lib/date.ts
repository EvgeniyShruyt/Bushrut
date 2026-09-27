/**
 * Всё, что связано с «днём», считается в APP_TIMEZONE, а не в UTC и не в зоне
 * сервера. Ключ дня — строка "YYYY-MM-DD"; арифметика над ключами ведётся через
 * Date.UTC, поэтому переходы на летнее время не сдвигают границы суток.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Moscow';

export type DateKey = string; // "YYYY-MM-DD"
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: 'Пн',
  TUE: 'Вт',
  WED: 'Ср',
  THU: 'Чт',
  FRI: 'Пт',
  SAT: 'Сб',
  SUN: 'Вс',
};

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Локальная дата момента времени как ключ "YYYY-MM-DD". */
export function dateKeyOf(instant: Date = new Date()): DateKey {
  return keyFormatter.format(instant);
}

/** Локальное время момента как "HH:MM". */
export function timeOf(instant: Date = new Date()): string {
  return timeFormatter.format(instant);
}

export function todayKey(): DateKey {
  return dateKeyOf(new Date());
}

function toUtcMidnight(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMidnight(ms: number): DateKey {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcMidnight(toUtcMidnight(key) + days * 86_400_000);
}

/** Целое число дней between: b - a. */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMidnight(b) - toUtcMidnight(a)) / 86_400_000);
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekdayOf(key: DateKey): Weekday {
  // getUTCDay(): 0 = воскресенье.
  const jsDay = new Date(toUtcMidnight(key)).getUTCDay();
  return WEEKDAYS[(jsDay + 6) % 7];
}

/** Понедельник недели, которой принадлежит день. */
export function startOfWeek(key: DateKey): DateKey {
  const idx = WEEKDAYS.indexOf(weekdayOf(key));
  return addDays(key, -idx);
}

/** ISO-неделя вида "2026-W37". Сравнимая строкой внутри года. */
export function isoWeekOf(key: DateKey): string {
  // Четверг недели определяет её год по ISO 8601.
  const thursday = addDays(startOfWeek(key), 3);
  const [year] = thursday.split('-').map(Number);
  const jan1 = `${year}-01-01`;
  const week = Math.floor(diffDays(startOfWeek(jan1), startOfWeek(thursday)) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Все ключи дней в интервале [from, to] включительно. */
export function datesBetween(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; compareKeys(k, to) <= 0; k = addDays(k, 1)) out.push(k);
  return out;
}

const humanFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});

/** "13 сентября, пятница" — для шапки экрана «Сегодня». */
export function humanDate(key: DateKey): string {
  const full = humanFormatter.format(new Date(toUtcMidnight(key)));
  const weekday = {
    MON: 'понедельник',
    TUE: 'вторник',
    WED: 'среда',
    THU: 'четверг',
    FRI: 'пятница',
    SAT: 'суббота',
    SUN: 'воскресенье',
  }[weekdayOf(key)];
  return `${full}, ${weekday}`;
}

/** Сколько полных дней осталось до сброса бюджетов (понедельник 00:00). */
export function daysUntilWeekReset(key: DateKey): number {
  return 7 - WEEKDAYS.indexOf(weekdayOf(key));
}
