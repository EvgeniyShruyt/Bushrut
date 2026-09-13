/**
 * «Топливный бак» недельного бюджета (раздел 6.3 ТЗ).
 * Тон намеренно нейтральный: превышение — не красный «провал», а просто
 * исчерпанный бак. Никаких крестиков и предупреждающих цветов (раздел 4.4).
 */
export function FuelTank({
  used,
  limit,
  segments = 10,
}: {
  used: number;
  limit: number;
  segments?: number;
}) {
  // Лимит 0 (полный отказ) показываем как один сегмент — бак либо цел, либо нет.
  const cells = limit > 0 ? Math.min(segments, Math.max(limit, 1)) : 1;
  const filledRatio = limit > 0 ? Math.min(1, used / limit) : used > 0 ? 1 : 0;
  const filled = Math.round(filledRatio * cells);
  const exhausted = limit > 0 ? used >= limit : used > 0;

  return (
    <div
      className="flex gap-1"
      role="img"
      aria-label={`Использовано ${used} из ${limit} за неделю`}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 flex-1 rounded-full transition-colors ${
            i < filled
              ? exhausted
                ? 'bg-signal-hold/70'
                : 'bg-electric'
              : 'bg-ink-line'
          }`}
        />
      ))}
    </div>
  );
}
