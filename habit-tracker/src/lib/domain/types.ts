import type { Habit } from '@prisma/client';
import { type DateKey, type Weekday, compareKeys, dateKeyOf, weekdayOf } from '@/lib/date';

export type HabitType = 'POSITIVE' | 'BUDGET';
export type TimeOfDay = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type DayType = 'OFFICE' | 'HOME' | 'OTHER';
export type VisibleWhen = 'ANY' | 'HOME_OR_OTHER' | 'OFFICE';
export type StatKey = 'health' | 'discipline' | 'mind' | 'family' | 'finance';
export type Category = 'body' | 'productivity' | 'family' | 'antihabit';

export const TIME_OF_DAY: TimeOfDay[] = ['MORNING', 'AFTERNOON', 'EVENING'];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  MORNING: 'Утро',
  AFTERNOON: 'День',
  EVENING: 'Вечер',
};

export const DAY_TYPES: DayType[] = ['HOME', 'OFFICE', 'OTHER'];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  HOME: 'Дом',
  OFFICE: 'Офис',
  OTHER: 'Другое место',
};

export const VISIBLE_WHEN_LABELS: Record<VisibleWhen, string> = {
  ANY: 'Всегда',
  HOME_OR_OTHER: 'Кроме офиса',
  OFFICE: 'Только в офисе',
};

export const STAT_KEYS: StatKey[] = ['health', 'discipline', 'mind', 'family', 'finance'];

export const STAT_LABELS: Record<StatKey, string> = {
  health: 'Здоровье',
  discipline: 'Дисциплина',
  mind: 'Разум',
  family: 'Семья',
  finance: 'Финансы',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  body: 'Тело',
  productivity: 'Продуктивность',
  family: 'Семья',
  antihabit: 'Антипривычка',
};

/** Строка daysOfWeek → набор дней. "ALL" означает каждый день. */
export function parseDaysOfWeek(value: string): Weekday[] | 'ALL' {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return 'ALL';
  return trimmed.split(',').map((d) => d.trim()) as Weekday[];
}

export function isScheduledOn(daysOfWeek: string, weekday: Weekday): boolean {
  const days = parseDaysOfWeek(daysOfWeek);
  return days === 'ALL' || days.includes(weekday);
}

export function isVisibleOn(visibleWhen: string, dayType: DayType): boolean {
  if (visibleWhen === 'OFFICE') return dayType === 'OFFICE';
  if (visibleWhen === 'HOME_OR_OTHER') return dayType !== 'OFFICE';
  return true;
}

export function dayTypeFor(map: Map<DateKey, DayType>, date: DateKey): DayType {
  return map.get(date) ?? 'HOME';
}

/** Обязательна ли привычка в этот день: активна, уже создана, по расписанию и видима. */
export function isRequiredOn(habit: Habit, date: DateKey, dayType: DayType): boolean {
  if (!habit.active) return false;
  if (compareKeys(date, dateKeyOf(habit.createdAt)) < 0) return false;
  if (!isScheduledOn(habit.daysOfWeek, weekdayOf(date))) return false;
  return isVisibleOn(habit.visibleWhen, dayType);
}
