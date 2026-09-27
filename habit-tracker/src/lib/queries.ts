import { prisma } from '@/lib/db';
import {
  type DateKey,
  type Weekday,
  WEEKDAYS,
  addDays,
  dateKeyOf,
  daysUntilWeekReset,
  diffDays,
  isoWeekOf,
  todayKey,
  weekdayOf,
} from '@/lib/date';
import { type DayType, type TimeOfDay, TIME_OF_DAY, isRequiredOn } from '@/lib/domain/types';
import { ensureUpToDate, weekDays } from '@/lib/domain/engine';
import { levelProgress } from '@/lib/domain/rules';
import { getDayHistory } from '@/lib/domain/history';
import { ACHIEVEMENTS, buildAchievementContext } from '@/lib/domain/achievements';

export async function getUserStats() {
  return prisma.userStats.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

export type TodayHabit = {
  id: string;
  name: string;
  timeOfDay: TimeOfDay;
  xpValue: number;
  currencyValue: number;
  unitLabel: string;
  dailyBinary: boolean;
  type: 'POSITIVE' | 'BUDGET';
  weeklyBudget: number | null;
  completed: boolean;
  budgetUsed: number;
  pitStopUsed: boolean;
  currentStreak: number;
  pitStopsAvailable: number;
  /** Сколько единиц бюджета израсходовано за текущую неделю (для BUDGET). */
  weekUsed: number;
};

export type TodayView = {
  date: DateKey;
  dayType: DayType;
  stats: Awaited<ReturnType<typeof getUserStats>>;
  level: ReturnType<typeof levelProgress>;
  blocks: { block: TimeOfDay; habits: TodayHabit[] }[];
  scheduleBlocks: { id: string; name: string; startTime: string; endTime: string }[];
  totalRequired: number;
  totalCompleted: number;
  pitStopsTotal: number;
};

export async function getTodayView(): Promise<TodayView> {
  await ensureUpToDate();

  const date = todayKey();
  const week = weekDays(date);

  const [dayEntry, habits, logs, streaks, blocks, stats, weekLogs] = await Promise.all([
    prisma.dayEntry.findUnique({ where: { date } }),
    prisma.habit.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.dailyLog.findMany({ where: { date } }),
    prisma.streak.findMany(),
    prisma.scheduleBlock.findMany({
      where: { dayOfWeek: weekdayOf(date) },
      orderBy: { startTime: 'asc' },
    }),
    getUserStats(),
    prisma.dailyLog.findMany({
      where: { date: { in: week.filter((d) => isoWeekOf(d) === isoWeekOf(date)) } },
      select: { habitId: true, budgetUsed: true },
    }),
  ]);

  const dayType = (dayEntry?.dayType ?? 'HOME') as DayType;
  const logMap = new Map(logs.map((l) => [l.habitId, l]));
  const streakMap = new Map(streaks.map((s) => [s.habitId, s]));
  const weekUsage = new Map<string, number>();
  for (const l of weekLogs) weekUsage.set(l.habitId, (weekUsage.get(l.habitId) ?? 0) + l.budgetUsed);

  const visible = habits.filter((h) => isRequiredOn(h, date, dayType));

  const toView = (h: (typeof habits)[number]): TodayHabit => {
    const log = logMap.get(h.id);
    const streak = streakMap.get(h.id);
    return {
      id: h.id,
      name: h.name,
      timeOfDay: h.timeOfDay as TimeOfDay,
      xpValue: h.xpValue,
      currencyValue: h.currencyValue,
      unitLabel: h.unitLabel,
      dailyBinary: h.dailyBinary,
      type: h.type as 'POSITIVE' | 'BUDGET',
      weeklyBudget: h.weeklyBudget,
      completed: log?.completed ?? false,
      budgetUsed: log?.budgetUsed ?? 0,
      pitStopUsed: log?.pitStopUsed ?? false,
      currentStreak: streak?.currentStreak ?? 0,
      pitStopsAvailable: streak?.pitStopsAvailable ?? 0,
      weekUsed: weekUsage.get(h.id) ?? 0,
    };
  };

  const positives = visible.filter((h) => h.type === 'POSITIVE');

  return {
    date,
    dayType,
    stats,
    level: levelProgress(stats.xpTotal),
    blocks: TIME_OF_DAY.map((block) => ({
      block,
      habits: visible.filter((h) => h.timeOfDay === block).map(toView),
    })),
    scheduleBlocks: blocks.map((b) => ({
      id: b.id,
      name: b.name,
      startTime: b.startTime,
      endTime: b.endTime,
    })),
    totalRequired: positives.length,
    totalCompleted: positives.filter((h) => logMap.get(h.id)?.completed).length,
    pitStopsTotal: streaks.reduce((s, x) => s + x.pitStopsAvailable, 0),
  };
}

export type BudgetView = {
  id: string;
  name: string;
  unitLabel: string;
  dailyBinary: boolean;
  weeklyBudget: number;
  used: number;
  todayUsed: number;
  /** Для лимита 0 — сколько дней подряд без срыва. */
  cleanDays: number;
  daysLeft: number;
  history: { week: string; used: number; limit: number; withinBudget: boolean; bonusPaid: number }[];
};

export async function getBudgetsView(): Promise<{ budgets: BudgetView[]; week: string }> {
  await ensureUpToDate();

  const date = todayKey();
  const week = isoWeekOf(date);
  const days = weekDays(date).filter((d) => isoWeekOf(d) === week);

  const habits = await prisma.habit.findMany({
    where: { type: 'BUDGET', active: true },
    orderBy: { sortOrder: 'asc' },
  });

  const budgets = await Promise.all(
    habits.map(async (habit): Promise<BudgetView> => {
      const [weekLogs, todayLog, history, recent] = await Promise.all([
        prisma.dailyLog.findMany({
          where: { habitId: habit.id, date: { in: days } },
          select: { budgetUsed: true },
        }),
        prisma.dailyLog.findUnique({ where: { habitId_date: { habitId: habit.id, date } } }),
        prisma.budgetWeek.findMany({
          where: { habitId: habit.id },
          orderBy: { week: 'desc' },
          take: 8,
        }),
        prisma.dailyLog.findMany({
          where: { habitId: habit.id, budgetUsed: { gt: 0 } },
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true },
        }),
      ]);

      // Отсчёт «без срыва» ведётся от последнего срыва, а если его не было —
      // от момента, когда привычку завели.
      const since = recent[0]?.date ?? dateKeyOf(habit.createdAt);
      const cleanDays = Math.max(0, diffDays(since, date));

      return {
        id: habit.id,
        name: habit.name,
        unitLabel: habit.unitLabel,
        dailyBinary: habit.dailyBinary,
        weeklyBudget: habit.weeklyBudget ?? 0,
        used: weekLogs.reduce((s, l) => s + l.budgetUsed, 0),
        todayUsed: todayLog?.budgetUsed ?? 0,
        cleanDays,
        daysLeft: daysUntilWeekReset(date),
        history: history.map((h) => ({
          week: h.week,
          used: h.used,
          limit: h.limit,
          withinBudget: h.withinBudget,
          bonusPaid: h.bonusPaid,
        })),
      };
    }),
  );

  return { budgets, week };
}

export async function getStatsView() {
  await ensureUpToDate();
  const [stats, streaks, habits] = await Promise.all([
    getUserStats(),
    prisma.streak.findMany({ orderBy: { currentStreak: 'desc' } }),
    prisma.habit.findMany({ where: { active: true }, select: { id: true, name: true, statTarget: true } }),
  ]);
  const names = new Map(habits.map((h) => [h.id, h.name]));
  return {
    stats,
    level: levelProgress(stats.xpTotal),
    streaks: streaks
      .filter((s) => names.has(s.habitId))
      .map((s) => ({
        habitId: s.habitId,
        name: names.get(s.habitId)!,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        pitStopsAvailable: s.pitStopsAvailable,
        daysTowardsPitStop: s.daysTowardsPitStop,
      })),
  };
}

export async function getTrophiesView() {
  await ensureUpToDate();

  const today = todayKey();
  const [ctx, unlocked] = await Promise.all([
    buildAchievementContext(today),
    prisma.achievement.findMany(),
  ]);
  const unlockedMap = new Map(unlocked.map((a) => [a.code, a.unlockedAt]));

  const history = await getDayHistory(addDays(today, -181), today);

  return {
    achievements: ACHIEVEMENTS.map((def) => ({
      code: def.code,
      title: def.title,
      description: def.description,
      emoji: def.emoji,
      target: def.target,
      progress: Math.min(def.target, def.progress(ctx)),
      unlockedAt: unlockedMap.get(def.code)?.toISOString() ?? null,
    })),
    history,
  };
}

export async function getShopView() {
  await ensureUpToDate();
  const [stats, rewards, purchases] = await Promise.all([
    getUserStats(),
    prisma.rewardItem.findMany({ where: { active: true }, orderBy: { cost: 'asc' } }),
    prisma.purchase.findMany({ orderBy: { purchasedAt: 'desc' }, take: 30, include: { rewardItem: true } }),
  ]);
  return {
    balance: stats.currencyBalance,
    rewards,
    purchases: purchases.map((p) => ({
      id: p.id,
      name: p.nameAtPurchase || p.rewardItem.name,
      emoji: p.rewardItem.emoji,
      costPaid: p.costPaid,
      purchasedAt: p.purchasedAt.toISOString(),
    })),
  };
}

export async function getSettingsView() {
  const [habits, blocks] = await Promise.all([
    prisma.habit.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] }),
    prisma.scheduleBlock.findMany({ orderBy: { startTime: 'asc' } }),
  ]);

  // В БД dayOfWeek — строка, поэтому порядок задаём по календарю, а не по алфавиту.
  const sortedBlocks = [...blocks].sort((a, b) => {
    const byDay =
      WEEKDAYS.indexOf(a.dayOfWeek as Weekday) - WEEKDAYS.indexOf(b.dayOfWeek as Weekday);
    return byDay !== 0 ? byDay : a.startTime.localeCompare(b.startTime);
  });

  return { habits, blocks: sortedBlocks };
}
