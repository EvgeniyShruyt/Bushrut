import Foundation
import SwiftData

/// Карточка = связка «сценарий → правильный инструмент → расчёт → ответ».
///
/// Важно: карточка хранит **шаблон** сценария, а не конкретные числа. Числа
/// подставляет `TaskGenerator` при каждом показе (см. `Engine/`), поэтому одна и та же
/// логика не заучивается по конкретным цифрам.
///
/// Прогресс трекается по двум независимым осям:
///  - распознавание (`recognition*`) — правильно ли выбран инструмент до расчёта;
///  - счёт (`compute*`, `emaSeconds`) — точность и скорость самого расчёта.
@Model
final class Card {
    /// Идентификатор шаблона в `TemplateRegistry`, например `m1.markup_to_margin`.
    @Attribute(.unique) var templateID: String
    var moduleID: String
    var title: String
    /// 1 — базовый уровень, 5 — сложный. Внутри модуля порядок «от простого к сложному».
    var difficulty: Int
    /// rawValue правильного `ToolKind` — для статистики по инструментам без загрузки шаблона.
    var toolRaw: String
    /// Ожидается ли устный счёт (влияет на таймер).
    var isMentalMath: Bool
    /// Порядок внутри модуля.
    var order: Int
    /// Шаблон удалён из кода — карточка остаётся ради истории, но не выдаётся.
    var isActive: Bool
    var createdAt: Date

    // MARK: - Состояние FSRS-5

    var stability: Double
    var fsrsDifficulty: Double
    var due: Date
    var lastReviewedAt: Date?
    var reps: Int
    var lapses: Int
    var schedulingStateRaw: String

    // MARK: - Ось 1: распознавание инструмента

    var recognitionAttempts: Int
    var recognitionCorrect: Int
    /// Скользящее окно последних результатов выбора инструмента (1 = верно).
    var recognitionWindow: [Int]

    // MARK: - Ось 2: скорость и точность счёта

    var computeAttempts: Int
    var computeCorrect: Int
    /// Скользящее окно последних результатов расчёта (1 = верно).
    var computeWindow: [Int]
    /// Экспоненциальное среднее времени верного расчёта, сек.
    var emaSeconds: Double?
    var bestSeconds: Double?
    /// Текущий лимит на счёт, сек. `nil` — тренировка без ограничения времени.
    var timeLimitSeconds: Double?

    @Relationship(deleteRule: .cascade, inverse: \Attempt.card)
    var attempts: [Attempt] = []

    var module: TrainingModule?

    init(
        templateID: String,
        moduleID: String,
        title: String,
        difficulty: Int,
        toolRaw: String,
        isMentalMath: Bool,
        order: Int,
        now: Date = Date()
    ) {
        self.templateID = templateID
        self.moduleID = moduleID
        self.title = title
        self.difficulty = difficulty
        self.toolRaw = toolRaw
        self.isMentalMath = isMentalMath
        self.order = order
        self.isActive = true
        self.createdAt = now

        self.stability = 0
        self.fsrsDifficulty = 0
        self.due = now
        self.lastReviewedAt = nil
        self.reps = 0
        self.lapses = 0
        self.schedulingStateRaw = SchedulingState.new.rawValue

        self.recognitionAttempts = 0
        self.recognitionCorrect = 0
        self.recognitionWindow = []
        self.computeAttempts = 0
        self.computeCorrect = 0
        self.computeWindow = []
        self.emaSeconds = nil
        self.bestSeconds = nil
        self.timeLimitSeconds = nil
    }
}

// MARK: - Производные свойства

extension Card {
    var schedulingState: SchedulingState {
        get { SchedulingState(rawValue: schedulingStateRaw) ?? .new }
        set { schedulingStateRaw = newValue.rawValue }
    }

    var tool: ToolKind {
        ToolKind(rawValue: toolRaw) ?? .markupToMargin
    }

    var isDue: Bool { due <= Date() }

    /// Доля верных выборов инструмента за всё время, 0…1.
    var recognitionAccuracy: Double {
        recognitionAttempts == 0 ? 0 : Double(recognitionCorrect) / Double(recognitionAttempts)
    }

    /// Доля верных расчётов за всё время, 0…1.
    var computeAccuracy: Double {
        computeAttempts == 0 ? 0 : Double(computeCorrect) / Double(computeAttempts)
    }

    /// Точность в скользящем окне — на неё смотрит `TimingPolicy` при сокращении лимита.
    func recentAccuracy(_ window: [Int]) -> Double {
        guard !window.isEmpty else { return 0 }
        return Double(window.reduce(0, +)) / Double(window.count)
    }

    var recentRecognitionAccuracy: Double { recentAccuracy(recognitionWindow) }
    var recentComputeAccuracy: Double { recentAccuracy(computeWindow) }

    func pushRecognition(correct: Bool, windowSize: Int = 6) {
        recognitionAttempts += 1
        if correct { recognitionCorrect += 1 }
        recognitionWindow.append(correct ? 1 : 0)
        if recognitionWindow.count > windowSize {
            recognitionWindow.removeFirst(recognitionWindow.count - windowSize)
        }
    }

    func pushCompute(correct: Bool, seconds: Double, windowSize: Int = 6) {
        computeAttempts += 1
        if correct { computeCorrect += 1 }
        computeWindow.append(correct ? 1 : 0)
        if computeWindow.count > windowSize {
            computeWindow.removeFirst(computeWindow.count - windowSize)
        }
        guard correct else { return }
        if let current = emaSeconds {
            emaSeconds = current * 0.7 + seconds * 0.3
        } else {
            emaSeconds = seconds
        }
        if bestSeconds == nil || seconds < (bestSeconds ?? .infinity) {
            bestSeconds = seconds
        }
    }
}

enum SchedulingState: String, Codable, CaseIterable {
    case new
    case learning
    case review
    case relearning

    var title: String {
        switch self {
        case .new: return "Новая"
        case .learning: return "Изучается"
        case .review: return "Повторение"
        case .relearning: return "Переучивается"
        }
    }
}
