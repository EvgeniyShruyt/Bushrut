import Foundation

/// Политика таймера на устный счёт.
///
/// Логика: сначала карточка тренируется без ограничения. Как только точность расчёта
/// в скользящем окне становится высокой, включается лимит — и дальше он сокращается
/// по мере роста точности, но не ниже пола. Ошибки лимит откатывают.
///
/// Точность распознавания инструмента на таймер не влияет: это отдельный навык
/// и торопить его вредно.
enum TimingPolicy {

    /// Точность в окне, с которой включается/сокращается лимит.
    static let tighteningAccuracy = 0.8
    /// Точность, ниже которой лимит ослабляется.
    static let looseningAccuracy = 0.5
    /// Шаг сокращения лимита.
    static let step = 0.85
    /// Шаг ослабления.
    static let relaxStep = 1.25
    /// Абсолютный минимум, ниже которого лимит не опускается.
    static let floorSeconds: Double = 12

    /// Лимит для текущего показа карточки.
    static func limit(for card: Card, task: GeneratedTask, settings: AppSettings) -> Double? {
        guard settings.timerEnabled else { return nil }
        // Разогрев: первые попытки — без давления, иначе тренируется паника, а не счёт.
        guard card.computeAttempts >= settings.untimedWarmupAttempts else { return nil }
        return card.timeLimitSeconds ?? task.baseSeconds
    }

    /// Новый лимит после попытки. Вызывать после `card.pushCompute(...)`.
    static func updatedLimit(
        for card: Card,
        task: GeneratedTask,
        settings: AppSettings,
        lastAttemptCorrect: Bool,
        lastAttemptSeconds: Double
    ) -> Double? {
        guard settings.timerEnabled else { return nil }
        guard card.computeAttempts >= settings.untimedWarmupAttempts else { return nil }

        let current = card.timeLimitSeconds ?? task.baseSeconds
        let accuracy = card.recentComputeAccuracy

        if !lastAttemptCorrect || accuracy < looseningAccuracy {
            return min(current * relaxStep, task.baseSeconds * 1.5)
        }
        guard accuracy >= tighteningAccuracy, card.computeWindow.count >= 3 else {
            return current
        }
        // Не сокращаем ниже реального темпа: цель — подтягивать, а не ломать.
        let paceFloor = max((card.emaSeconds ?? lastAttemptSeconds) * 0.9, floorSeconds)
        return max(current * step, paceFloor)
    }

    /// Насколько карточка «разогнана» относительно базового времени, 0…1.
    static func speedIndex(card: Card, baseSeconds: Double) -> Double {
        guard let ema = card.emaSeconds, ema > 0, baseSeconds > 0 else { return 0 }
        // 1.0 = вдвое быстрее базового времени и лучше.
        let ratio = baseSeconds / ema
        return min(max((ratio - 0.5) / 1.5, 0), 1)
    }
}
