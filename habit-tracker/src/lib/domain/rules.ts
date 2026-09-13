/**
 * Числовые правила игры в одном месте — их предполагается тюнить (раздел 4 ТЗ).
 */

/** level = floor(sqrt(xpTotal / 50)) + 1 */
export const XP_PER_LEVEL_UNIT = 50;

/** Бонус за полностью закрытый блок дня (Утро/День/Вечер) — доля от XP блока. */
export const BLOCK_COMPLETION_XP_BONUS = 0.2;

/** Бонус «Топлива» за полностью закрытый день — доля от валюты дня. */
export const FULL_DAY_CURRENCY_BONUS = 0.2;

/** Сколько дней подряд без пропуска даёт один пит-стоп. */
export const PIT_STOP_EARN_DAYS = 7;

/** Максимум пит-стопов в запасе одновременно. */
export const PIT_STOP_MAX = 3;

/** Множитель награды за неделю, закрытую в рамках бюджета антипривычки. */
export const BUDGET_WEEK_BONUS_MULTIPLIER = 5;

export function levelFromXp(xpTotal: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xpTotal) / XP_PER_LEVEL_UNIT)) + 1;
}

/** Сколько всего XP нужно, чтобы достичь уровня. */
export function xpForLevel(level: number): number {
  return XP_PER_LEVEL_UNIT * Math.pow(Math.max(1, level) - 1, 2);
}

export type LevelProgress = {
  level: number;
  xpTotal: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0..1
};

export function levelProgress(xpTotal: number): LevelProgress {
  const level = levelFromXp(xpTotal);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  return {
    level,
    xpTotal,
    xpIntoLevel: xpTotal - floor,
    xpForNextLevel: ceil - floor,
    progress: Math.min(1, Math.max(0, (xpTotal - floor) / span)),
  };
}

/** Очки стата за выполнение привычки. */
export function statGain(xpValue: number): number {
  return Math.floor(xpValue / 2);
}
