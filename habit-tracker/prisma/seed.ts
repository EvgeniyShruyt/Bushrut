/**
 * Стартовый набор: привычки собраны из разделов 4.4 и 5 ТЗ (в разделе 3 списка
 * привычек нет — там только схема). Всё редактируется в «Настройках», так что
 * это именно точка старта, а не жёсткий набор.
 *
 * Скрипт идемпотентен: id детерминированы, повторный запуск обновляет записи,
 * не плодя дубликаты и не трогая накопленные логи.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type HabitSeed = {
  id: string;
  name: string;
  category: string;
  statTarget: string;
  type: 'POSITIVE' | 'BUDGET';
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  daysOfWeek?: string;
  visibleWhen?: string;
  weeklyBudget?: number;
  unitLabel?: string;
  dailyBinary?: boolean;
  xpValue?: number;
  currencyValue?: number;
};

const HABITS: HabitSeed[] = [
  // --- Утро ---
  {
    id: 'h-wakeup',
    name: 'Подъём без «ещё пять минут»',
    category: 'productivity',
    statTarget: 'discipline',
    type: 'POSITIVE',
    timeOfDay: 'MORNING',
    xpValue: 10,
    currencyValue: 10,
  },
  {
    id: 'h-workout',
    name: 'Тренировка',
    category: 'body',
    statTarget: 'health',
    type: 'POSITIVE',
    timeOfDay: 'MORNING',
    // Раздел 5: тренировка только Пн/Ср/Пт, независимо от типа дня.
    daysOfWeek: 'MON,WED,FRI',
    visibleWhen: 'ANY',
    xpValue: 25,
    currencyValue: 25,
  },
  {
    id: 'h-dayplan',
    name: 'План дня на пять минут',
    category: 'productivity',
    statTarget: 'discipline',
    type: 'POSITIVE',
    timeOfDay: 'MORNING',
    daysOfWeek: 'MON,TUE,WED,THU,FRI',
    xpValue: 10,
    currencyValue: 10,
  },

  // --- День ---
  {
    id: 'h-cardio',
    name: 'Кардио в обед',
    category: 'body',
    statTarget: 'health',
    type: 'POSITIVE',
    timeOfDay: 'AFTERNOON',
    // Раздел 5: в офисные дни скрывается.
    visibleWhen: 'HOME_OR_OTHER',
    xpValue: 15,
    currencyValue: 15,
  },
  {
    id: 'h-siesta',
    name: 'Тихий час',
    category: 'body',
    statTarget: 'health',
    type: 'POSITIVE',
    timeOfDay: 'AFTERNOON',
    visibleWhen: 'HOME_OR_OTHER',
    xpValue: 10,
    currencyValue: 10,
  },
  {
    id: 'h-deepwork',
    name: 'Глубокая работа 90 минут',
    category: 'productivity',
    statTarget: 'mind',
    type: 'POSITIVE',
    timeOfDay: 'AFTERNOON',
    daysOfWeek: 'MON,TUE,WED,THU,FRI',
    xpValue: 20,
    currencyValue: 20,
  },

  // --- Вечер ---
  {
    id: 'h-reading',
    name: 'Чтение 20 страниц',
    category: 'productivity',
    statTarget: 'mind',
    type: 'POSITIVE',
    timeOfDay: 'EVENING',
    xpValue: 15,
    currencyValue: 15,
  },
  {
    id: 'h-family-time',
    name: 'Час с ребёнком без телефона',
    category: 'family',
    statTarget: 'family',
    type: 'POSITIVE',
    timeOfDay: 'EVENING',
    xpValue: 20,
    currencyValue: 20,
  },
  {
    id: 'h-lights-out',
    name: 'Отбой до 23:30',
    category: 'body',
    statTarget: 'health',
    type: 'POSITIVE',
    timeOfDay: 'EVENING',
    xpValue: 15,
    currencyValue: 15,
  },

  // --- Антипривычки (раздел 4.4), дефолтные лимиты с недельным сбросом ---
  {
    id: 'h-alcohol',
    name: 'Алкоголь',
    category: 'antihabit',
    statTarget: 'health',
    type: 'BUDGET',
    timeOfDay: 'EVENING',
    weeklyBudget: 1,
    unitLabel: 'порция',
    xpValue: 20,
    currencyValue: 20,
  },
  {
    id: 'h-junkfood',
    name: 'Junk food',
    category: 'antihabit',
    statTarget: 'health',
    type: 'BUDGET',
    timeOfDay: 'AFTERNOON',
    weeklyBudget: 2,
    unitLabel: 'приём',
    xpValue: 15,
    currencyValue: 15,
  },
  {
    id: 'h-scrolling',
    name: 'Скроллинг сверх лимита',
    category: 'antihabit',
    statTarget: 'discipline',
    type: 'BUDGET',
    timeOfDay: 'EVENING',
    // MVP: честный self-report «уложился / не уложился», без экранного времени.
    dailyBinary: true,
    weeklyBudget: 2,
    unitLabel: 'день сверх лимита',
    xpValue: 15,
    currencyValue: 15,
  },
  {
    id: 'h-vape',
    name: 'Вейп',
    category: 'antihabit',
    statTarget: 'health',
    type: 'BUDGET',
    timeOfDay: 'EVENING',
    // Полный отказ: лимит 0 → экран показывает счётчик «дней без вейпа».
    dailyBinary: true,
    weeklyBudget: 0,
    unitLabel: 'день с вейпом',
    xpValue: 25,
    currencyValue: 25,
  },
];

const SCHEDULE_BLOCKS = [
  ...['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => ({
    id: `sb-school-${day.toLowerCase()}`,
    name: 'Отвезти ребёнка в школу',
    dayOfWeek: day,
    startTime: '08:15',
    endTime: '08:25',
  })),
  {
    id: 'sb-english-thu',
    name: 'Английский',
    dayOfWeek: 'THU',
    startTime: '09:00',
    endTime: '10:00',
  },
];

// Примеры наград — чтобы магазин не был пустым. Раздел 4.5: позиции заводит
// сам пользователь, эти три можно удалить в «Магазине».
const REWARDS = [
  { id: 'r-cinema', name: 'Поход в кино', cost: 300, emoji: '🎬' },
  { id: 'r-game-evening', name: 'Вечер за игрой', cost: 150, emoji: '🎮' },
  { id: 'r-gadget', name: 'Новый гаджет', cost: 2000, emoji: '🎧' },
];

async function main() {
  for (const [index, habit] of HABITS.entries()) {
    const data = {
      name: habit.name,
      category: habit.category,
      statTarget: habit.statTarget,
      type: habit.type,
      timeOfDay: habit.timeOfDay,
      daysOfWeek: habit.daysOfWeek ?? 'ALL',
      visibleWhen: habit.visibleWhen ?? 'ANY',
      weeklyBudget: habit.weeklyBudget ?? null,
      unitLabel: habit.unitLabel ?? 'раз',
      dailyBinary: habit.dailyBinary ?? false,
      xpValue: habit.xpValue ?? 10,
      currencyValue: habit.currencyValue ?? 10,
      sortOrder: index,
      active: true,
    };
    await prisma.habit.upsert({
      where: { id: habit.id },
      update: data,
      create: { id: habit.id, ...data },
    });
    if (habit.type === 'POSITIVE') {
      await prisma.streak.upsert({
        where: { habitId: habit.id },
        update: {},
        create: { habitId: habit.id },
      });
    }
  }

  for (const block of SCHEDULE_BLOCKS) {
    const { id, ...rest } = block;
    await prisma.scheduleBlock.upsert({
      where: { id },
      update: rest,
      create: { id, ...rest },
    });
  }

  for (const reward of REWARDS) {
    const { id, ...rest } = reward;
    await prisma.rewardItem.upsert({
      where: { id },
      update: {},
      create: { id, ...rest },
    });
  }

  await prisma.userStats.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  await prisma.appState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  console.log(
    `Готово: ${HABITS.length} привычек, ${SCHEDULE_BLOCKS.length} блоков расписания, ${REWARDS.length} наград.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
