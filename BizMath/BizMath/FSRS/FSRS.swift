import Foundation

/// Оценка ответа в терминах FSRS.
enum FSRSRating: Int, Codable, CaseIterable, Identifiable {
    case again = 1
    case hard = 2
    case good = 3
    case easy = 4

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .again: return "Провалил"
        case .hard: return "С трудом"
        case .good: return "Норм"
        case .easy: return "Легко"
        }
    }

    var symbolName: String {
        switch self {
        case .again: return "arrow.counterclockwise"
        case .hard: return "tortoise"
        case .good: return "checkmark"
        case .easy: return "hare"
        }
    }
}

/// Состояние карточки в терминах FSRS — отделено от SwiftData-модели,
/// чтобы алгоритм можно было тестировать и подменять без обращения к хранилищу.
struct FSRSCardState: Equatable {
    var stability: Double
    var difficulty: Double
    var due: Date
    var lastReviewedAt: Date?
    var reps: Int
    var lapses: Int
    var state: SchedulingState

    static func new(now: Date = Date()) -> FSRSCardState {
        FSRSCardState(
            stability: 0,
            difficulty: 0,
            due: now,
            lastReviewedAt: nil,
            reps: 0,
            lapses: 0,
            state: .new
        )
    }
}

/// Параметры FSRS-5 (19 весов).
struct FSRSParameters: Equatable {
    var w: [Double]
    /// Целевая вероятность вспоминания на момент показа.
    var desiredRetention: Double
    var maximumIntervalDays: Double
    /// Разброс интервала, чтобы повторения не слипались в один день. 0 — выключено.
    var fuzzFactor: Double

    /// Дефолтные веса FSRS-5.
    static let defaultWeights: [Double] = [
        0.40255, 1.18385, 3.173, 15.69105,
        7.1949, 0.5345, 1.4604, 0.0046,
        1.54575, 0.1192, 1.01925, 1.9395,
        0.11, 0.29605, 2.2698, 0.2315,
        2.9898, 0.51655, 0.6621
    ]

    static let `default` = FSRSParameters(
        w: defaultWeights,
        desiredRetention: 0.90,
        maximumIntervalDays: 365 * 3,
        fuzzFactor: 0.05
    )
}

/// Планировщик FSRS-5.
///
/// Кривая забывания степенная: `R(t) = (1 + FACTOR * t / S) ^ DECAY`.
/// Формулы стабильности/сложности — канонические для FSRS-5, включая
/// краткосрочную (в пределах суток) ветку через w[17], w[18].
struct FSRSScheduler {
    static let decay: Double = -0.5
    /// FACTOR = 0.9^(1/DECAY) − 1 = 19/81
    static let factor: Double = 19.0 / 81.0

    var parameters: FSRSParameters

    init(parameters: FSRSParameters = .default) {
        self.parameters = parameters
    }

    private var w: [Double] { parameters.w }

    // MARK: - Публичный API

    /// Вероятность вспоминания карточки на момент `now`.
    func retrievability(state: FSRSCardState, now: Date) -> Double {
        guard state.state != .new, state.stability > 0 else { return 0 }
        let elapsed = max(0, elapsedDays(from: state.lastReviewedAt, to: now))
        return Self.retrievability(elapsedDays: elapsed, stability: state.stability)
    }

    static func retrievability(elapsedDays: Double, stability: Double) -> Double {
        guard stability > 0 else { return 0 }
        return pow(1 + factor * elapsedDays / stability, decay)
    }

    /// Интервал в днях до момента, когда вероятность вспоминания упадёт до `desiredRetention`.
    func intervalDays(stability: Double) -> Double {
        let raw = stability / Self.factor * (pow(parameters.desiredRetention, 1 / Self.decay) - 1)
        return min(max(raw, 1), parameters.maximumIntervalDays)
    }

    /// Применяет оценку и возвращает новое состояние карточки.
    func review(
        state: FSRSCardState,
        rating: FSRSRating,
        now: Date = Date(),
        randomness: Double? = nil
    ) -> FSRSCardState {
        var next = state
        next.reps += 1
        next.lastReviewedAt = now

        if state.state == .new {
            next.stability = initialStability(rating)
            next.difficulty = initialDifficulty(rating)
        } else {
            let elapsed = max(0, elapsedDays(from: state.lastReviewedAt, to: now))
            let r = Self.retrievability(elapsedDays: elapsed, stability: state.stability)
            next.difficulty = nextDifficulty(state.difficulty, rating: rating)
            if elapsed < 1 {
                // Тот же день: краткосрочная память, длинные формулы неприменимы.
                next.stability = shortTermStability(state.stability, rating: rating)
            } else if rating == .again {
                next.stability = forgetStability(
                    stability: state.stability,
                    difficulty: state.difficulty,
                    retrievability: r
                )
            } else {
                next.stability = recallStability(
                    stability: state.stability,
                    difficulty: next.difficulty,
                    retrievability: r,
                    rating: rating
                )
            }
        }

        next.stability = clamp(next.stability, 0.01, 36500)
        next.difficulty = clamp(next.difficulty, 1, 10)

        if rating == .again, state.state == .review {
            next.lapses += 1
        }

        // Короткие шаги для «провалил»/«с трудом» — карточка возвращается в этой же сессии.
        switch (state.state, rating) {
        case (_, .again):
            next.state = state.state == .new ? .learning : .relearning
            next.due = now.addingTimeInterval(5 * 60)
        case (.new, .hard), (.learning, .hard), (.relearning, .hard):
            next.state = state.state == .new ? .learning : state.state
            next.due = now.addingTimeInterval(10 * 60)
        default:
            next.state = .review
            let days = fuzzed(intervalDays(stability: next.stability), randomness: randomness)
            next.due = now.addingTimeInterval(days * 86_400)
        }

        return next
    }

    /// Сколько дней до следующего показа даст каждая оценка — для подписей на кнопках.
    func previewIntervals(state: FSRSCardState, now: Date = Date()) -> [FSRSRating: TimeInterval] {
        var result: [FSRSRating: TimeInterval] = [:]
        for rating in FSRSRating.allCases {
            let next = review(state: state, rating: rating, now: now, randomness: 0.5)
            result[rating] = next.due.timeIntervalSince(now)
        }
        return result
    }

    // MARK: - Формулы FSRS-5

    private func initialStability(_ rating: FSRSRating) -> Double {
        max(w[rating.rawValue - 1], 0.01)
    }

    private func initialDifficulty(_ rating: FSRSRating) -> Double {
        clamp(w[4] - exp(w[5] * Double(rating.rawValue - 1)) + 1, 1, 10)
    }

    /// Сложность с линейным затуханием и возвратом к среднему (mean reversion к D0(easy)).
    private func nextDifficulty(_ difficulty: Double, rating: FSRSRating) -> Double {
        let delta = -w[6] * Double(rating.rawValue - 3)
        let damped = difficulty + delta * (10 - difficulty) / 9
        let target = initialDifficulty(.easy)
        return clamp(w[7] * target + (1 - w[7]) * damped, 1, 10)
    }

    private func recallStability(
        stability: Double,
        difficulty: Double,
        retrievability: Double,
        rating: FSRSRating
    ) -> Double {
        let hardPenalty = rating == .hard ? w[15] : 1
        let easyBonus = rating == .easy ? w[16] : 1
        let growth = 1
            + exp(w[8])
            * (11 - difficulty)
            * pow(stability, -w[9])
            * (exp((1 - retrievability) * w[10]) - 1)
            * hardPenalty
            * easyBonus
        return stability * growth
    }

    private func forgetStability(
        stability: Double,
        difficulty: Double,
        retrievability: Double
    ) -> Double {
        let longTerm = w[11]
            * pow(difficulty, -w[12])
            * (pow(stability + 1, w[13]) - 1)
            * exp((1 - retrievability) * w[14])
        // FSRS-5: стабильность после провала не может превысить краткосрочную оценку.
        let shortTermCeiling = stability / exp(w[17] * w[18])
        return min(longTerm, shortTermCeiling)
    }

    private func shortTermStability(_ stability: Double, rating: FSRSRating) -> Double {
        stability * exp(w[17] * (Double(rating.rawValue) - 3 + w[18]))
    }

    // MARK: - Утилиты

    private func elapsedDays(from: Date?, to: Date) -> Double {
        guard let from else { return 0 }
        return to.timeIntervalSince(from) / 86_400
    }

    private func fuzzed(_ days: Double, randomness: Double?) -> Double {
        guard parameters.fuzzFactor > 0, days >= 2.5 else { return days }
        let roll = randomness ?? Double.random(in: 0...1)
        let spread = days * parameters.fuzzFactor
        let delta = (roll * 2 - 1) * spread
        return min(max(days + delta, 1), parameters.maximumIntervalDays)
    }

    private func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double {
        min(max(value, low), high)
    }
}

// MARK: - Мост между Card и FSRSCardState

extension Card {
    var fsrsState: FSRSCardState {
        FSRSCardState(
            stability: stability,
            difficulty: fsrsDifficulty,
            due: due,
            lastReviewedAt: lastReviewedAt,
            reps: reps,
            lapses: lapses,
            state: schedulingState
        )
    }

    func apply(_ state: FSRSCardState) {
        stability = state.stability
        fsrsDifficulty = state.difficulty
        due = state.due
        lastReviewedAt = state.lastReviewedAt
        reps = state.reps
        lapses = state.lapses
        schedulingState = state.state
    }
}
