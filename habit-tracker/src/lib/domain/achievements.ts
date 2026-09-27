import { prisma } from '@/lib/db';
import { type DateKey, todayKey } from '@/lib/date';
import { levelFromXp } from './rules';
import { getDayHistory } from './history';

export type AchievementDef = {
  code: string;
  title: string;
  description: string;
  emoji: string;
  /** Для прогресс-бара на карточке трофея. */
  target: number;
  progress: (ctx: AchievementContext) => number;
};

export type AchievementContext = {
  bestStreak: number;
  level: number;
  perfectDays: number;
  perfectWeekStreak: number;
  cleanBudgetWeeks: number;
  cleanBudgetWeekStreak: number;
  purchases: number;
  pitStopsUsed: number;
  totalCompletions: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'streak_7',
    title: 'Первый круг',
    description: '7 дней подряд по одной привычке',
    emoji: '🏁',
    target: 7,
    progress: (c) => c.bestStreak,
  },
  {
    code: 'streak_30',
    title: 'Гран-при',
    description: '30 дней подряд по одной привычке',
    emoji: '🏆',
    target: 30,
    progress: (c) => c.bestStreak,
  },
  {
    code: 'streak_100',
    title: 'Сотка',
    description: '100 дней подряд по одной привычке',
    emoji: '💎',
    target: 100,
    progress: (c) => c.bestStreak,
  },
  {
    code: 'level_5',
    title: 'Разгон',
    description: 'Достичь 5 уровня',
    emoji: '⚡',
    target: 5,
    progress: (c) => c.level,
  },
  {
    code: 'level_10',
    title: 'Форсаж',
    description: 'Достичь 10 уровня',
    emoji: '🔥',
    target: 10,
    progress: (c) => c.level,
  },
  {
    code: 'perfect_day_1',
    title: 'Чистый круг',
    description: 'Закрыть все привычки за день',
    emoji: '✅',
    target: 1,
    progress: (c) => c.perfectDays,
  },
  {
    code: 'perfect_day_10',
    title: 'Десять из десяти',
    description: '10 полностью закрытых дней',
    emoji: '🎯',
    target: 10,
    progress: (c) => c.perfectDays,
  },
  {
    code: 'perfect_week',
    title: 'Идеальная неделя',
    description: '7 полностью закрытых дней подряд',
    emoji: '🗓️',
    target: 7,
    progress: (c) => c.perfectWeekStreak,
  },
  {
    code: 'budget_week_1',
    title: 'В рамках бюджета',
    description: 'Неделя в пределах всех лимитов',
    emoji: '⛽',
    target: 1,
    progress: (c) => c.cleanBudgetWeeks,
  },
  {
    code: 'budget_week_4',
    title: 'Месяц на своей полосе',
    description: '4 недели подряд в пределах лимитов',
    emoji: '🛞',
    target: 4,
    progress: (c) => c.cleanBudgetWeekStreak,
  },
  {
    code: 'pit_stop',
    title: 'Пит-стоп',
    description: 'Использовать пит-стоп вместо срыва стрика',
    emoji: '🔧',
    target: 1,
    progress: (c) => c.pitStopsUsed,
  },
  {
    code: 'first_purchase',
    title: 'Заслужено',
    description: 'Купить первую награду',
    emoji: '🎁',
    target: 1,
    progress: (c) => c.purchases,
  },
  {
    code: 'completions_100',
    title: 'Сотня отметок',
    description: '100 выполненных привычек суммарно',
    emoji: '📈',
    target: 100,
    progress: (c) => c.totalCompletions,
  },
];

export async function buildAchievementContext(today: DateKey = todayKey()): Promise<AchievementContext> {
  const [streaks, stats, purchases, pitStops, completions, budgetWeeks, firstLog] = await Promise.all([
    prisma.streak.aggregate({ _max: { longestStreak: true } }),
    prisma.userStats.findUnique({ where: { id: 'singleton' } }),
    prisma.purchase.count(),
    prisma.dailyLog.count({ where: { pitStopUsed: true } }),
    prisma.dailyLog.count({ where: { completed: true } }),
    prisma.budgetWeek.findMany({ orderBy: { week: 'asc' } }),
    prisma.dailyLog.findFirst({ orderBy: { date: 'asc' }, select: { date: true } }),
  ]);

  const history = firstLog ? await getDayHistory(firstLog.date, today) : [];

  let perfectDays = 0;
  let perfectWeekStreak = 0;
  let runningPerfect = 0;
  for (const day of history) {
    if (day.perfect) {
      perfectDays += 1;
      runningPerfect += 1;
      perfectWeekStreak = Math.max(perfectWeekStreak, runningPerfect);
    } else if (day.ratio !== -1) {
      runningPerfect = 0;
    }
  }

  // Неделя «чистая», если все бюджетные привычки уложились в лимит.
  const byWeek = new Map<string, boolean>();
  for (const bw of budgetWeeks) {
    byWeek.set(bw.week, (byWeek.get(bw.week) ?? true) && bw.withinBudget);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let cleanBudgetWeeks = 0;
  let cleanBudgetWeekStreak = 0;
  let runningClean = 0;
  for (const [, clean] of weeks) {
    if (clean) {
      cleanBudgetWeeks += 1;
      runningClean += 1;
      cleanBudgetWeekStreak = Math.max(cleanBudgetWeekStreak, runningClean);
    } else {
      runningClean = 0;
    }
  }

  return {
    bestStreak: streaks._max.longestStreak ?? 0,
    level: levelFromXp(stats?.xpTotal ?? 0),
    perfectDays,
    perfectWeekStreak,
    cleanBudgetWeeks,
    cleanBudgetWeekStreak,
    purchases,
    pitStopsUsed: pitStops,
    totalCompletions: completions,
  };
}

/** Фиксирует новые открытые ачивки. Идемпотентно. */
export async function checkAchievements(today: DateKey = todayKey()): Promise<string[]> {
  const unlocked = await prisma.achievement.findMany({ select: { code: true } });
  const known = new Set(unlocked.map((a) => a.code));

  // Сбор контекста читает всю историю логов, поэтому когда открывать уже нечего —
  // выходим до него. Проверка дёргается на каждой отметке привычки.
  if (ACHIEVEMENTS.every((def) => known.has(def.code))) return [];

  const ctx = await buildAchievementContext(today);
  const fresh: string[] = [];

  for (const def of ACHIEVEMENTS) {
    if (known.has(def.code)) continue;
    if (def.progress(ctx) >= def.target) {
      await prisma.achievement.create({ data: { code: def.code } });
      fresh.push(def.code);
    }
  }
  return fresh;
}

