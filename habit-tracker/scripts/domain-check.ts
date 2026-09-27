/**
 * Проверка игровой логики на подставной истории: стрики, пит-стопы, откат
 * начислений, недельные бюджеты.
 *
 * Запуск: npm run test:domain — скрипт работает на отдельной базе prisma/test.db
 * и полностью её очищает, рабочие данные не трогает.
 */
import { PrismaClient } from '@prisma/client';
import { addDays, todayKey, isoWeekOf } from '../src/lib/date';

const prisma = new PrismaClient();

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (ожидалось ${JSON.stringify(expected)})`}`);
}

async function main() {
  const engine = await import('../src/lib/domain/engine');
  const today = todayKey();

  // --- чистим ---
  await prisma.ledgerEntry.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.dayEntry.deleteMany();
  await prisma.budgetWeek.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.appState.deleteMany();

  // --- сценарий 1: стрик 10 дней, пит-стоп гасит один пропуск ---
  const start = addDays(today, -19);
  const habit = await prisma.habit.create({
    data: {
      id: 'test-daily',
      name: 'Тестовая ежедневная',
      category: 'body',
      statTarget: 'health',
      type: 'POSITIVE',
      timeOfDay: 'MORNING',
      daysOfWeek: 'ALL',
      visibleWhen: 'ANY',
      xpValue: 10,
      currencyValue: 10,
      createdAt: new Date(`${start}T06:00:00Z`),
    },
  });

  // 8 дней подряд выполнено (день -19 ... -12) → один пит-стоп на 7-й день
  for (let i = 0; i < 8; i++) {
    await prisma.dailyLog.create({
      data: { habitId: habit.id, date: addDays(start, i), completed: true },
    });
  }
  // день -11 пропущен → должен списаться пит-стоп, стрик не рвётся
  // дни -10 ... -1 выполнены (10 дней)
  for (let i = 9; i < 19; i++) {
    await prisma.dailyLog.create({
      data: { habitId: habit.id, date: addDays(start, i), completed: true },
    });
  }

  await engine.recomputeStreak(habit.id, today);
  const streak = await prisma.streak.findUnique({ where: { habitId: habit.id } });
  // 8 + (пит-стоп, стрик сохранён) + 10 = 18
  check('стрик пережил пропуск через пит-стоп', streak?.currentStreak, 18);
  check('пит-стоп потрачен (заработано 2 за 14 дней, потрачен 1)', streak?.pitStopsAvailable, 1);
  const pitStopLog = await prisma.dailyLog.findUnique({
    where: { habitId_date: { habitId: habit.id, date: addDays(start, 8) } },
  });
  check('пропущенный день помечен пит-стопом', pitStopLog?.pitStopUsed, true);

  // --- сценарий 2: без пит-стопов стрик обнуляется ---
  await prisma.dailyLog.deleteMany({ where: { habitId: habit.id } });
  for (let i = 0; i < 3; i++) {
    await prisma.dailyLog.create({
      data: { habitId: habit.id, date: addDays(start, i), completed: true },
    });
  }
  for (let i = 15; i < 19; i++) {
    await prisma.dailyLog.create({
      data: { habitId: habit.id, date: addDays(start, i), completed: true },
    });
  }
  await engine.recomputeStreak(habit.id, today);
  const streak2 = await prisma.streak.findUnique({ where: { habitId: habit.id } });
  check('стрик обнулён без пит-стопов', streak2?.currentStreak, 4);
  check('рекорд зафиксирован', streak2?.longestStreak, 4);

  // --- сценарий 3: начисления и откат отметки ---
  await prisma.dailyLog.deleteMany({ where: { habitId: habit.id } });
  await prisma.dailyLog.create({ data: { habitId: habit.id, date: today, completed: true } });
  await engine.recomputeDay(today);
  let stats = await prisma.userStats.findUnique({ where: { id: 'singleton' } });
  // 10 XP + 20% бонус за закрытый блок = 12; топливо 10 + 20% за закрытый день = 12
  check('XP за день с бонусом блока', stats?.xpTotal, 12);
  check('топливо за полностью закрытый день', stats?.currencyBalance, 12);
  check('стат здоровья', stats?.health, 5);

  await prisma.dailyLog.update({
    where: { habitId_date: { habitId: habit.id, date: today } },
    data: { completed: false },
  });
  await engine.recomputeDay(today);
  stats = await prisma.userStats.findUnique({ where: { id: 'singleton' } });
  check('снятие отметки откатывает XP полностью', stats?.xpTotal, 0);
  check('снятие отметки откатывает топливо', stats?.currencyBalance, 0);
  check('снятие отметки откатывает стат', stats?.health, 0);

  // --- сценарий 4: недельный бюджет ---
  const budget = await prisma.habit.create({
    data: {
      id: 'test-budget',
      name: 'Тестовый бюджет',
      category: 'antihabit',
      statTarget: 'health',
      type: 'BUDGET',
      timeOfDay: 'EVENING',
      weeklyBudget: 1,
      currencyValue: 20,
      xpValue: 20,
      createdAt: new Date(`${start}T06:00:00Z`),
    },
  });

  const lastWeekDay = addDays(today, -7);
  await prisma.dailyLog.create({
    data: { habitId: budget.id, date: lastWeekDay, budgetUsed: 1 },
  });
  await engine.closeFinishedWeeks(today);

  const closed = await prisma.budgetWeek.findUnique({
    where: { habitId_week: { habitId: budget.id, week: isoWeekOf(lastWeekDay) } },
  });
  check('неделя закрыта в рамках лимита', closed?.withinBudget, true);
  check('бонус начислен ×5', closed?.bonusPaid, 100);

  stats = await prisma.userStats.findUnique({ where: { id: 'singleton' } });
  check('бонус попал в баланс', stats?.currencyBalance, 100);

  // Повторный вызов не должен начислить второй раз.
  await engine.closeFinishedWeeks(today);
  stats = await prisma.userStats.findUnique({ where: { id: 'singleton' } });
  check('повторное закрытие недель идемпотентно', stats?.currencyBalance, 100);

  // --- сценарий 5: превышение бюджета не штрафует, просто без бонуса ---
  await prisma.budgetWeek.deleteMany();
  await prisma.ledgerEntry.deleteMany({ where: { kind: 'WEEK_BONUS' } });
  await prisma.appState.updateMany({ data: { lastClosedWeek: null } });
  await prisma.dailyLog.updateMany({
    where: { habitId: budget.id, date: lastWeekDay },
    data: { budgetUsed: 5 },
  });
  await engine.closeFinishedWeeks(today);
  const over = await prisma.budgetWeek.findUnique({
    where: { habitId_week: { habitId: budget.id, week: isoWeekOf(lastWeekDay) } },
  });
  check('превышение зафиксировано без бонуса', [over?.withinBudget, over?.bonusPaid], [false, 0]);
  stats = await prisma.userStats.findUnique({ where: { id: 'singleton' } });
  check('превышение не уводит баланс в минус', stats?.currencyBalance, 0);

  console.log(failures === 0 ? '\nВсе проверки пройдены' : `\nПровалено проверок: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
