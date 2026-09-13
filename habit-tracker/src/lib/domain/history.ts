import { prisma } from '@/lib/db';
import { type DateKey, datesBetween } from '@/lib/date';
import { type DayType, dayTypeFor, isRequiredOn } from './types';

export type DaySummary = {
  date: DateKey;
  dayType: DayType;
  required: number;
  completed: number;
  pitStops: number;
  /** 0..1; -1 означает «в этот день нечего было делать». */
  ratio: number;
  perfect: boolean;
};

/**
 * Посуточная сводка выполнения — основа тепловой карты и части ачивок.
 * Один проход по логам за период, без запроса на каждый день.
 */
export async function getDayHistory(from: DateKey, to: DateKey): Promise<DaySummary[]> {
  const [habits, logs, dayEntries] = await Promise.all([
    prisma.habit.findMany({ where: { type: 'POSITIVE' } }),
    prisma.dailyLog.findMany({
      where: { date: { gte: from, lte: to } },
      select: { habitId: true, date: true, completed: true, pitStopUsed: true },
    }),
    prisma.dayEntry.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, dayType: true },
    }),
  ]);

  const dayTypes = new Map(dayEntries.map((d) => [d.date, d.dayType as DayType]));
  const completedByDate = new Map<DateKey, Set<string>>();
  const pitStopsByDate = new Map<DateKey, number>();

  for (const log of logs) {
    if (log.completed) {
      if (!completedByDate.has(log.date)) completedByDate.set(log.date, new Set());
      completedByDate.get(log.date)!.add(log.habitId);
    }
    if (log.pitStopUsed) pitStopsByDate.set(log.date, (pitStopsByDate.get(log.date) ?? 0) + 1);
  }

  return datesBetween(from, to).map((date) => {
    const dayType = dayTypeFor(dayTypes, date);
    const required = habits.filter((h) => isRequiredOn(h, date, dayType));
    const done = completedByDate.get(date) ?? new Set<string>();
    const completed = required.filter((h) => done.has(h.id)).length;
    return {
      date,
      dayType,
      required: required.length,
      completed,
      pitStops: pitStopsByDate.get(date) ?? 0,
      ratio: required.length === 0 ? -1 : completed / required.length,
      perfect: required.length > 0 && completed === required.length,
    };
  });
}
