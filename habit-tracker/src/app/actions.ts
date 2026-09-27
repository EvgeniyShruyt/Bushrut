'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { todayKey } from '@/lib/date';
import type { DayType } from '@/lib/domain/types';
import {
  allLoggedDates,
  ensureUpToDate,
  invalidateSyncCache,
  recomputeAllStreaks,
  recomputeDay,
  recomputeDays,
  recomputeStreak,
  syncUserStats,
} from '@/lib/domain/engine';
import { checkAchievements } from '@/lib/domain/achievements';
import { SESSION_COOKIE } from '@/lib/auth';

const APP_PATHS = ['/', '/stats', '/budgets', '/trophies', '/shop', '/settings'];

function revalidateAll() {
  for (const path of APP_PATHS) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Экран «Сегодня»
// ---------------------------------------------------------------------------

export async function setDayType(dayType: DayType) {
  const date = todayKey();
  await prisma.dayEntry.upsert({
    where: { date },
    update: { dayType },
    create: { date, dayType },
  });
  // Тип дня меняет набор обязательных привычек → бонусы и стрики пересчитываются.
  await recomputeDay(date);
  await recomputeAllStreaks(date);
  await checkAchievements(date);
  revalidateAll();
}

export async function toggleHabit(habitId: string, completed: boolean) {
  const date = todayKey();
  await ensureUpToDate();

  await prisma.dailyLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { completed, pitStopUsed: false },
    create: { habitId, date, completed },
  });

  await recomputeDay(date);
  await recomputeStreak(habitId, date);
  await checkAchievements(date);
  revalidateAll();
}

/** BUDGET-привычка: счётчик употреблений за сегодня. Отрицательных значений нет. */
export async function setBudgetUsed(habitId: string, value: number) {
  const date = todayKey();
  const budgetUsed = Math.max(0, Math.round(value));

  await prisma.dailyLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { budgetUsed },
    create: { habitId, date, budgetUsed },
  });

  revalidateAll();
}

export async function bumpBudget(habitId: string, delta: number) {
  const date = todayKey();
  const existing = await prisma.dailyLog.findUnique({
    where: { habitId_date: { habitId, date } },
  });
  await setBudgetUsed(habitId, (existing?.budgetUsed ?? 0) + delta);
}

// ---------------------------------------------------------------------------
// Магазин наград
// ---------------------------------------------------------------------------

export async function createReward(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const cost = Number(formData.get('cost') ?? 0);
  const emoji = String(formData.get('emoji') ?? '🏁').trim() || '🏁';
  if (!name || !Number.isFinite(cost) || cost <= 0) return;

  await prisma.rewardItem.create({ data: { name, cost: Math.round(cost), emoji } });
  revalidateAll();
}

export async function deleteReward(id: string) {
  // Мягкое удаление: история покупок должна пережить удаление позиции.
  await prisma.rewardItem.update({ where: { id }, data: { active: false } });
  revalidateAll();
}

export type PurchaseResult = { ok: true } | { ok: false; error: string };

export async function purchaseReward(rewardItemId: string): Promise<PurchaseResult> {
  const [reward, stats] = await Promise.all([
    prisma.rewardItem.findUnique({ where: { id: rewardItemId } }),
    prisma.userStats.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!reward || !reward.active) return { ok: false, error: 'Награда не найдена' };

  const balance = stats?.currencyBalance ?? 0;
  // Раздел 4.5: покупка в минус невозможна, кредита нет.
  if (balance < reward.cost) {
    return { ok: false, error: `Не хватает ${reward.cost - balance} топлива` };
  }

  const purchase = await prisma.purchase.create({
    data: {
      rewardItemId: reward.id,
      costPaid: reward.cost,
      nameAtPurchase: reward.name,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      key: `purchase:${purchase.id}`,
      date: todayKey(),
      kind: 'PURCHASE',
      currency: -reward.cost,
    },
  });

  await syncUserStats();
  await checkAchievements();
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Настройки: привычки
// ---------------------------------------------------------------------------

function habitDataFromForm(formData: FormData) {
  const type = String(formData.get('type') ?? 'POSITIVE');
  const weeklyBudgetRaw = formData.get('weeklyBudget');
  const days = formData.getAll('daysOfWeek').map(String).filter(Boolean);

  return {
    name: String(formData.get('name') ?? '').trim(),
    category: String(formData.get('category') ?? 'body'),
    statTarget: String(formData.get('statTarget') ?? 'health'),
    type,
    timeOfDay: String(formData.get('timeOfDay') ?? 'MORNING'),
    daysOfWeek: days.length === 0 || days.length === 7 ? 'ALL' : days.join(','),
    visibleWhen: String(formData.get('visibleWhen') ?? 'ANY'),
    weeklyBudget:
      type === 'BUDGET' && weeklyBudgetRaw !== null && weeklyBudgetRaw !== ''
        ? Math.max(0, Number(weeklyBudgetRaw))
        : null,
    unitLabel: String(formData.get('unitLabel') ?? 'раз').trim() || 'раз',
    dailyBinary: formData.get('dailyBinary') === 'on',
    xpValue: Math.max(1, Number(formData.get('xpValue') ?? 10)),
    currencyValue: Math.max(0, Number(formData.get('currencyValue') ?? 10)),
  };
}

export async function createHabit(formData: FormData) {
  const data = habitDataFromForm(formData);
  if (!data.name) return;

  const last = await prisma.habit.findFirst({ orderBy: { sortOrder: 'desc' } });
  const habit = await prisma.habit.create({
    data: { ...data, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  if (habit.type === 'POSITIVE') {
    await prisma.streak.create({ data: { habitId: habit.id } });
  }

  invalidateSyncCache();
  await ensureUpToDate(true);
  revalidateAll();
}

export async function updateHabit(id: string, formData: FormData) {
  const data = habitDataFromForm(formData);
  if (!data.name) return;

  await prisma.habit.update({ where: { id }, data });

  // Правка расписания/видимости меняет, какие дни считались обязательными.
  await recomputeDays(await allLoggedDates());
  invalidateSyncCache();
  await ensureUpToDate(true);
  revalidateAll();
}

export async function setHabitActive(id: string, active: boolean) {
  await prisma.habit.update({ where: { id }, data: { active } });
  await recomputeDays(await allLoggedDates());
  invalidateSyncCache();
  await ensureUpToDate(true);
  revalidateAll();
}

export async function deleteHabit(id: string) {
  const dates = await allLoggedDates();
  await prisma.habit.delete({ where: { id } });
  await recomputeDays(dates);
  // Бонусы за недели удалённой привычки больше не действительны.
  await prisma.ledgerEntry.deleteMany({ where: { key: { endsWith: `:${id}` }, kind: 'WEEK_BONUS' } });
  await prisma.budgetWeek.deleteMany({ where: { habitId: id } });
  await syncUserStats();
  invalidateSyncCache();
  await ensureUpToDate(true);
  revalidateAll();
}

export async function reorderHabit(id: string, direction: 'up' | 'down') {
  const habits = await prisma.habit.findMany({ orderBy: { sortOrder: 'asc' } });
  const index = habits.findIndex((h) => h.id === id);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= habits.length) return;

  await prisma.habit.update({
    where: { id: habits[index].id },
    data: { sortOrder: habits[swapWith].sortOrder },
  });
  await prisma.habit.update({
    where: { id: habits[swapWith].id },
    data: { sortOrder: habits[index].sortOrder },
  });
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Настройки: блоки расписания
// ---------------------------------------------------------------------------

export async function createScheduleBlock(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const days = formData.getAll('dayOfWeek').map(String).filter(Boolean);
  const startTime = String(formData.get('startTime') ?? '').trim();
  const endTime = String(formData.get('endTime') ?? '').trim();
  if (!name || days.length === 0 || !startTime || !endTime) return;

  await prisma.scheduleBlock.createMany({
    data: days.map((dayOfWeek) => ({ name, dayOfWeek, startTime, endTime })),
  });
  revalidateAll();
}

export async function deleteScheduleBlock(id: string) {
  await prisma.scheduleBlock.delete({ where: { id } });
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Сессия
// ---------------------------------------------------------------------------

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
  redirect('/login');
}
