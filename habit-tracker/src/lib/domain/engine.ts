import type { Habit } from '@prisma/client';
import { prisma } from '@/lib/db';
import { checkAchievements } from './achievements';
import {
  type DateKey,
  addDays,
  compareKeys,
  dateKeyOf,
  datesBetween,
  isoWeekOf,
  todayKey,
  weekdayOf,
} from '@/lib/date';
import {
  type DayType,
  type StatKey,
  type TimeOfDay,
  STAT_KEYS,
  TIME_OF_DAY,
  dayTypeFor,
  isRequiredOn,
} from './types';
import {
  BLOCK_COMPLETION_XP_BONUS,
  BUDGET_WEEK_BONUS_MULTIPLIER,
  FULL_DAY_CURRENCY_BONUS,
  PIT_STOP_EARN_DAYS,
  PIT_STOP_MAX,
  statGain,
} from './rules';

const SINGLETON = 'singleton';

type StatDelta = Record<StatKey, number>;

function emptyStats(): StatDelta {
  return { health: 0, discipline: 0, mind: 0, family: 0, finance: 0 };
}

export async function getAppState() {
  return prisma.appState.upsert({
    where: { id: SINGLETON },
    update: {},
    create: { id: SINGLETON },
  });
}

/** Тип дня; для дней, в которые приложение не открывали, — значение по умолчанию. */
export async function getDayTypeMap(from: DateKey, to: DateKey): Promise<Map<DateKey, DayType>> {
  const rows = await prisma.dayEntry.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, dayType: true },
  });
  return new Map(rows.map((r) => [r.date, r.dayType as DayType]));
}

// ---------------------------------------------------------------------------
// Начисления за день
// ---------------------------------------------------------------------------

/** Пересчитывает начисления за один день. */
export async function recomputeDay(date: DateKey): Promise<void> {
  await recomputeDays([date]);
}

/**
 * Пересчитывает начисления за набор дней с нуля и переписывает по одной записи
 * леджера на день. Благодаря идемпотентности снятие галочки откатывает ровно
 * то, что начислило, а правка привычки задним числом не оставляет «хвостов».
 */
export async function recomputeDays(dates: DateKey[]): Promise<void> {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return;

  const [habits, logs, dayEntries] = await Promise.all([
    prisma.habit.findMany(),
    prisma.dailyLog.findMany({
      where: { date: { in: unique }, completed: true },
      select: { habitId: true, date: true },
    }),
    prisma.dayEntry.findMany({
      where: { date: { in: unique } },
      select: { date: true, dayType: true },
    }),
  ]);

  const byId = new Map(habits.map((h) => [h.id, h]));
  const dayTypes = new Map(dayEntries.map((d) => [d.date, d.dayType as DayType]));
  const completedByDate = new Map<DateKey, Set<string>>();
  for (const log of logs) {
    if (!completedByDate.has(log.date)) completedByDate.set(log.date, new Set());
    completedByDate.get(log.date)!.add(log.habitId);
  }

  for (const date of unique) {
    const dayType = dayTypeFor(dayTypes, date);
    const completed = completedByDate.get(date) ?? new Set<string>();

    const stats = emptyStats();
    let xp = 0;
    let currency = 0;

    for (const habitId of completed) {
      const habit = byId.get(habitId);
      if (!habit || habit.type !== 'POSITIVE') continue;
      xp += habit.xpValue;
      currency += habit.currencyValue;
      stats[habit.statTarget as StatKey] += statGain(habit.xpValue);
    }

    // Бонус за полностью закрытый блок дня (Утро / День / Вечер).
    const required = habits.filter((h) => h.type === 'POSITIVE' && isRequiredOn(h, date, dayType));
    for (const block of TIME_OF_DAY) {
      const inBlock = required.filter((h) => h.timeOfDay === block);
      if (inBlock.length === 0) continue;
      if (inBlock.every((h) => completed.has(h.id))) {
        xp += Math.round(BLOCK_COMPLETION_XP_BONUS * inBlock.reduce((s, h) => s + h.xpValue, 0));
      }
    }

    // Бонус «Топлива» за полностью закрытый день.
    if (required.length > 0 && required.every((h) => completed.has(h.id))) {
      currency += Math.round(
        FULL_DAY_CURRENCY_BONUS * required.reduce((s, h) => s + h.currencyValue, 0),
      );
    }

    const key = `day:${date}`;
    const hasAnything = xp !== 0 || currency !== 0 || STAT_KEYS.some((k) => stats[k] !== 0);

    if (!hasAnything) {
      await prisma.ledgerEntry.deleteMany({ where: { key } });
    } else {
      const payload = { date, kind: 'DAY', xp, currency, ...stats };
      await prisma.ledgerEntry.upsert({
        where: { key },
        update: payload,
        create: { key, ...payload },
      });
    }
  }

  await syncUserStats();
}

/** Все даты, за которые вообще есть отметки, — для полного пересчёта. */
export async function allLoggedDates(): Promise<DateKey[]> {
  const rows = await prisma.dailyLog.findMany({ select: { date: true }, distinct: ['date'] });
  return rows.map((r) => r.date);
}

/** UserStats — материализованный кэш поверх леджера. */
export async function syncUserStats() {
  const sum = await prisma.ledgerEntry.aggregate({
    _sum: {
      xp: true,
      currency: true,
      health: true,
      discipline: true,
      mind: true,
      family: true,
      finance: true,
    },
  });
  const s = sum._sum;
  const data = {
    xpTotal: s.xp ?? 0,
    currencyBalance: s.currency ?? 0,
    health: s.health ?? 0,
    discipline: s.discipline ?? 0,
    mind: s.mind ?? 0,
    family: s.family ?? 0,
    finance: s.finance ?? 0,
  };
  return prisma.userStats.upsert({
    where: { id: SINGLETON },
    update: data,
    create: { id: SINGLETON, ...data },
  });
}

// ---------------------------------------------------------------------------
// Стрики и пит-стопы
// ---------------------------------------------------------------------------

export type StreakSimulation = {
  currentStreak: number;
  longestStreak: number;
  pitStopsAvailable: number;
  daysTowardsPitStop: number;
  lastPitStopEarnedAt: DateKey | null;
  pitStopDays: DateKey[];
};

/**
 * Стрики не мутируются инкрементально, а каждый раз пересчитываются с нуля по
 * логам. Пересчёт идемпотентен, поэтому правка задним числом, смена расписания
 * или отмена отметки не оставляют рассинхрона.
 */
export function simulateStreak(
  habit: Habit,
  logs: Map<DateKey, { completed: boolean }>,
  dayTypes: Map<DateKey, DayType>,
  today: DateKey,
): StreakSimulation {
  const start = dateKeyOf(habit.createdAt);
  const result: StreakSimulation = {
    currentStreak: 0,
    longestStreak: 0,
    pitStopsAvailable: 0,
    daysTowardsPitStop: 0,
    lastPitStopEarnedAt: null,
    pitStopDays: [],
  };
  if (compareKeys(start, today) > 0) return result;

  for (const date of datesBetween(start, today)) {
    const dayType = dayTypeFor(dayTypes, date);
    if (!isRequiredOn(habit, date, dayType)) continue;

    const done = logs.get(date)?.completed === true;

    if (done) {
      result.currentStreak += 1;
      result.daysTowardsPitStop += 1;
      if (result.daysTowardsPitStop >= PIT_STOP_EARN_DAYS) {
        result.daysTowardsPitStop = 0;
        if (result.pitStopsAvailable < PIT_STOP_MAX) {
          result.pitStopsAvailable += 1;
          result.lastPitStopEarnedAt = date;
        }
      }
      result.longestStreak = Math.max(result.longestStreak, result.currentStreak);
      continue;
    }

    // Сегодняшний день ещё не закончился — это не пропуск.
    if (date === today) continue;

    if (result.pitStopsAvailable > 0) {
      result.pitStopsAvailable -= 1;
      result.pitStopDays.push(date);
      // Стрик сохраняется, но день не засчитывается как выполненный.
    } else {
      result.longestStreak = Math.max(result.longestStreak, result.currentStreak);
      result.currentStreak = 0;
      result.daysTowardsPitStop = 0;
    }
  }

  result.longestStreak = Math.max(result.longestStreak, result.currentStreak);
  return result;
}

export async function recomputeStreak(habitId: string, today: DateKey = todayKey()) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.type !== 'POSITIVE') return;

  const start = dateKeyOf(habit.createdAt);
  const [logs, dayTypes] = await Promise.all([
    prisma.dailyLog.findMany({ where: { habitId } }),
    getDayTypeMap(start, today),
  ]);

  const logMap = new Map(logs.map((l) => [l.date, l]));
  const sim = simulateStreak(habit, logMap, dayTypes, today);
  const pitStopSet = new Set(sim.pitStopDays);

  // Проставляем отметки пит-стопов только там, где они изменились.
  for (const date of pitStopSet) {
    const existing = logMap.get(date);
    if (existing?.pitStopUsed) continue;
    await prisma.dailyLog.upsert({
      where: { habitId_date: { habitId, date } },
      update: { pitStopUsed: true },
      create: { habitId, date, pitStopUsed: true },
    });
  }
  for (const log of logs) {
    if (log.pitStopUsed && !pitStopSet.has(log.date)) {
      await prisma.dailyLog.update({ where: { id: log.id }, data: { pitStopUsed: false } });
    }
  }

  await prisma.streak.upsert({
    where: { habitId },
    update: {
      currentStreak: sim.currentStreak,
      longestStreak: sim.longestStreak,
      pitStopsAvailable: sim.pitStopsAvailable,
      daysTowardsPitStop: sim.daysTowardsPitStop,
      lastPitStopEarnedAt: sim.lastPitStopEarnedAt
        ? new Date(`${sim.lastPitStopEarnedAt}T00:00:00Z`)
        : null,
    },
    create: {
      habitId,
      currentStreak: sim.currentStreak,
      longestStreak: sim.longestStreak,
      pitStopsAvailable: sim.pitStopsAvailable,
      daysTowardsPitStop: sim.daysTowardsPitStop,
      lastPitStopEarnedAt: sim.lastPitStopEarnedAt
        ? new Date(`${sim.lastPitStopEarnedAt}T00:00:00Z`)
        : null,
    },
  });
}

export async function recomputeAllStreaks(today: DateKey = todayKey()) {
  const habits = await prisma.habit.findMany({ where: { type: 'POSITIVE' }, select: { id: true } });
  for (const h of habits) await recomputeStreak(h.id, today);
}

// ---------------------------------------------------------------------------
// Недельные бюджеты антипривычек
// ---------------------------------------------------------------------------

/** Сколько единиц бюджета израсходовано в неделе, которой принадлежит день. */
export async function budgetUsageForWeek(habitId: string, anyDayOfWeek: DateKey): Promise<number> {
  const week = isoWeekOf(anyDayOfWeek);
  const days = weekDays(anyDayOfWeek).filter((d) => isoWeekOf(d) === week);
  const logs = await prisma.dailyLog.findMany({
    where: { habitId, date: { in: days } },
    select: { budgetUsed: true },
  });
  return logs.reduce((s, l) => s + l.budgetUsed, 0);
}

export function weekDays(anyDayOfWeek: DateKey): DateKey[] {
  const monday = addDays(anyDayOfWeek, -((weekdayIndex(anyDayOfWeek) + 7) % 7));
  return datesBetween(monday, addDays(monday, 6));
}

function weekdayIndex(date: DateKey): number {
  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].indexOf(weekdayOf(date));
}

/**
 * Закрывает все недели, которые уже завершились, и начисляет бонус за те, что
 * уложились в бюджет. Вызывается лениво при заходе в приложение — без cron.
 */
export async function closeFinishedWeeks(today: DateKey = todayKey()) {
  const state = await getAppState();
  const currentWeekMonday = weekDays(today)[0];

  const firstLog = await prisma.dailyLog.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });
  if (!firstLog) return;

  let cursor = state.lastClosedWeek
    ? addDays(lastDayOfIsoWeek(state.lastClosedWeek), 1)
    : weekDays(firstLog.date)[0];

  const budgetHabits = await prisma.habit.findMany({ where: { type: 'BUDGET' } });
  if (budgetHabits.length === 0) {
    await prisma.appState.update({
      where: { id: SINGLETON },
      data: { lastClosedWeek: isoWeekOf(addDays(currentWeekMonday, -1)) },
    });
    return;
  }

  let lastClosed = state.lastClosedWeek ?? null;
  let guard = 0;

  while (compareKeys(cursor, currentWeekMonday) < 0 && guard++ < 520) {
    const week = isoWeekOf(cursor);
    const days = weekDays(cursor);

    for (const habit of budgetHabits) {
      if (compareKeys(days[6], dateKeyOf(habit.createdAt)) < 0) continue;
      const already = await prisma.budgetWeek.findUnique({
        where: { habitId_week: { habitId: habit.id, week } },
      });
      if (already) continue;

      const logs = await prisma.dailyLog.findMany({
        where: { habitId: habit.id, date: { in: days } },
        select: { budgetUsed: true },
      });
      const used = logs.reduce((s, l) => s + l.budgetUsed, 0);
      const limit = habit.weeklyBudget ?? 0;
      const withinBudget = used <= limit;
      const bonus = withinBudget ? habit.currencyValue * BUDGET_WEEK_BONUS_MULTIPLIER : 0;

      await prisma.budgetWeek.create({
        data: { habitId: habit.id, week, used, limit, withinBudget, bonusPaid: bonus },
      });

      if (withinBudget) {
        const stats = emptyStats();
        const xp = habit.xpValue * BUDGET_WEEK_BONUS_MULTIPLIER;
        stats[habit.statTarget as StatKey] += statGain(xp);
        await prisma.ledgerEntry.upsert({
          where: { key: `week:${week}:${habit.id}` },
          update: {},
          create: {
            key: `week:${week}:${habit.id}`,
            date: days[6],
            kind: 'WEEK_BONUS',
            xp,
            currency: bonus,
            ...stats,
          },
        });
      }
    }

    lastClosed = week;
    cursor = addDays(cursor, 7);
  }

  if (lastClosed && lastClosed !== state.lastClosedWeek) {
    await prisma.appState.update({ where: { id: SINGLETON }, data: { lastClosedWeek: lastClosed } });
    await syncUserStats();
  }
}

function lastDayOfIsoWeek(week: string): DateKey {
  const [yearPart, weekPart] = week.split('-W');
  const year = Number(yearPart);
  const weekNo = Number(weekPart);
  const jan1 = `${year}-01-01`;
  const firstMonday = weekDays(jan1)[0];
  return addDays(firstMonday, (weekNo - 1) * 7 + 6);
}

// ---------------------------------------------------------------------------
// Ленивая синхронизация при заходе в приложение (раздел 4.4 / 8 ТЗ)
// ---------------------------------------------------------------------------

let lastSyncedDay: DateKey | null = null;

/**
 * Догоняет состояние до сегодняшнего дня: закрывает прошедшие недели бюджетов и
 * пересчитывает стрики с учётом пропусков. Никаких фоновых воркеров — вся работа
 * выполняется при первом заходе в новый день.
 */
export async function ensureUpToDate(force = false): Promise<void> {
  const today = todayKey();
  if (!force && lastSyncedDay === today) return;

  const state = await getAppState();
  if (!force && state.lastProcessedDate === today && lastSyncedDay === today) return;

  await closeFinishedWeeks(today);

  if (force || state.lastProcessedDate !== today) {
    await recomputeAllStreaks(today);
    await checkAchievements(today);
    await prisma.appState.update({
      where: { id: SINGLETON },
      data: { lastProcessedDate: today },
    });
  }

  lastSyncedDay = today;
}

/** Сбрасывает внутренний кэш — нужен после мутаций, меняющих расписание. */
export function invalidateSyncCache() {
  lastSyncedDay = null;
}

export { dayTypeFor, isRequiredOn } from './types';
