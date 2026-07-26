import Foundation

/// Единица измерения ответа — от неё зависят клавиатура, суффикс поля и допуск по умолчанию.
enum AnswerUnit: String, Codable {
    case percent
    case percentagePoints
    case rubles
    case units
    case months
    case days
    case times

    var suffix: String {
        switch self {
        case .percent: return "%"
        case .percentagePoints: return "п.п."
        case .rubles: return "₽"
        case .units: return "шт"
        case .months: return "мес"
        case .days: return "дн"
        case .times: return "×"
        }
    }

    /// Допуск по умолчанию — устный счёт не обязан давать точность до копейки.
    var defaultTolerance: Tolerance {
        switch self {
        case .percent, .percentagePoints: return .absolute(0.7)
        case .rubles: return .relative(0.02)
        case .units: return .relative(0.02)
        case .months, .days: return .absolute(0.6)
        case .times: return .absolute(0.06)
        }
    }
}

enum Tolerance: Codable, Equatable {
    /// Допуск в абсолютных единицах ответа (например, ±0.7 п.п.).
    case absolute(Double)
    /// Относительный допуск (например, ±2 %).
    case relative(Double)

    func matches(_ given: Double, expected: Double) -> Bool {
        switch self {
        case .absolute(let eps):
            return abs(given - expected) <= eps + 1e-9
        case .relative(let share):
            return abs(given - expected) <= abs(expected) * share + 1e-9
        }
    }

    func description(expected: Double, unit: AnswerUnit) -> String {
        switch self {
        case .absolute(let eps):
            return "допуск ±\(Fmt.number(eps)) \(unit.suffix)"
        case .relative(let share):
            return "допуск ±\(Fmt.number(share * 100)) %"
        }
    }
}

/// Готовая к показу задача: конкретные числа подставлены, ответ посчитан.
struct GeneratedTask: Identifiable {
    let id = UUID()
    let templateID: String
    let moduleID: String
    let seed: UInt64

    /// Деловая ситуация: переговоры, отчёт, планёрка. Не «реши уравнение».
    let scenario: String
    /// Что именно спрашиваем.
    let question: String

    /// Шаг 1 — выбор инструмента. Уже перемешаны.
    let options: [ToolKind]
    let correctTool: ToolKind

    /// Шаг 2 — расчёт.
    let answer: Double
    let unit: AnswerUnit
    let tolerance: Tolerance

    /// 2–3 строки интуиции. Без вывода формул.
    let explanation: String
    /// Короткий приём устного счёта: как считать «в голове», а не «в столбик».
    let mentalTrick: String
    /// Опорные величины для разбора («Наценка 38 % → 0,38/1,38»).
    let workings: [String]

    /// Базовый лимит времени на счёт для этой задачи, сек (до адаптации по прогрессу).
    let baseSeconds: Double

    var formattedAnswer: String {
        Fmt.answer(answer, unit: unit)
    }
}
