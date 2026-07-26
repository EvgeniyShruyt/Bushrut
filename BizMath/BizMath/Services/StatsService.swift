import Foundation
import SwiftData

/// Агрегация прогресса по двум независимым осям:
///  - **распознавание** — доля верно выбранных инструментов (до расчёта);
///  - **скорость счёта** — медианное время верного расчёта и доля попаданий в лимит.
///
/// Оси считаются раздельно намеренно: можно быстро считать не то, что нужно,
/// и наоборот — верно выбирать инструмент, но тонуть в арифметике.
enum StatsService {

    struct DayPoint: Identifiable {
        let id = UUID()
        let date: Date
        let attempts: Int
        let recognitionAccuracy: Double
        let computeAccuracy: Double
        let medianSeconds: Double?
        let withinLimitShare: Double?
    }

    struct AxisSummary {
        var attempts: Int
        var recognitionAccuracy: Double
        var computeAccuracy: Double
        var medianSeconds: Double?
        var withinLimitShare: Double?
        var cleanShare: Double
    }

    struct ModuleSummary: Identifiable {
        let id: String
        let title: String
        let attempts: Int
        let recognitionAccuracy: Double
        let computeAccuracy: Double
        let medianSeconds: Double?
        let cardsTotal: Int
        let cardsStarted: Int
    }

    struct Confusion: Identifiable {
        let id = UUID()
        let expected: ToolKind
        let chosen: ToolKind
        let count: Int
    }

    // MARK: - Выборка

    static func attempts(context: ModelContext, since: Date? = nil) -> [Attempt] {
        var descriptor = FetchDescriptor<Attempt>(sortBy: [SortDescriptor(\.date, order: .reverse)])
        if let since {
            descriptor.predicate = #Predicate<Attempt> { $0.date >= since }
        }
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Сводки

    static func summary(_ attempts: [Attempt]) -> AxisSummary {
        guard !attempts.isEmpty else {
            return AxisSummary(
                attempts: 0,
                recognitionAccuracy: 0,
                computeAccuracy: 0,
                medianSeconds: nil,
                withinLimitShare: nil,
                cleanShare: 0
            )
        }
        let recognition = share(attempts.map(\.toolCorrect))
        let compute = share(attempts.map(\.answerCorrect))
        let correctTimes = attempts.filter(\.answerCorrect).map(\.computeSeconds)
        let timed = attempts.filter { $0.timeLimitSeconds != nil }
        return AxisSummary(
            attempts: attempts.count,
            recognitionAccuracy: recognition,
            computeAccuracy: compute,
            medianSeconds: median(correctTimes),
            withinLimitShare: timed.isEmpty ? nil : share(timed.map(\.withinTimeLimit)),
            cleanShare: share(attempts.map(\.isClean))
        )
    }

    static func daily(_ attempts: [Attempt], days: Int = 14, now: Date = Date()) -> [DayPoint] {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: now)
        let grouped = Dictionary(grouping: attempts) { calendar.startOfDay(for: $0.date) }

        return (0..<days).reversed().compactMap { offset -> DayPoint? in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: startOfToday) else { return nil }
            let items = grouped[day] ?? []
            let correctTimes = items.filter(\.answerCorrect).map(\.computeSeconds)
            let timed = items.filter { $0.timeLimitSeconds != nil }
            return DayPoint(
                date: day,
                attempts: items.count,
                recognitionAccuracy: items.isEmpty ? 0 : share(items.map(\.toolCorrect)),
                computeAccuracy: items.isEmpty ? 0 : share(items.map(\.answerCorrect)),
                medianSeconds: median(correctTimes),
                withinLimitShare: timed.isEmpty ? nil : share(timed.map(\.withinTimeLimit))
            )
        }
    }

    static func modules(context: ModelContext, attempts: [Attempt]) -> [ModuleSummary] {
        let cards = (try? context.fetch(FetchDescriptor<Card>()))?.filter(\.isActive) ?? []
        let byModule = Dictionary(grouping: attempts, by: \.moduleID)
        let cardsByModule = Dictionary(grouping: cards, by: \.moduleID)

        return ModuleCatalog.all.map { descriptor in
            let items = byModule[descriptor.id] ?? []
            let moduleCards = cardsByModule[descriptor.id] ?? []
            return ModuleSummary(
                id: descriptor.id,
                title: descriptor.title,
                attempts: items.count,
                recognitionAccuracy: items.isEmpty ? 0 : share(items.map(\.toolCorrect)),
                computeAccuracy: items.isEmpty ? 0 : share(items.map(\.answerCorrect)),
                medianSeconds: median(items.filter(\.answerCorrect).map(\.computeSeconds)),
                cardsTotal: moduleCards.count,
                cardsStarted: moduleCards.filter { $0.reps > 0 }.count
            )
        }
    }

    /// Самые частые подмены инструментов — что именно путается с чем.
    static func confusions(_ attempts: [Attempt], limit: Int = 5) -> [Confusion] {
        var counts: [String: (ToolKind, ToolKind, Int)] = [:]
        for attempt in attempts where !attempt.toolCorrect {
            guard let chosen = attempt.chosenTool else { continue }
            let key = "\(attempt.correctToolRaw)>\(chosen.rawValue)"
            let existing = counts[key]?.2 ?? 0
            counts[key] = (attempt.correctTool, chosen, existing + 1)
        }
        return counts.values
            .sorted { $0.2 > $1.2 }
            .prefix(limit)
            .map { Confusion(expected: $0.0, chosen: $0.1, count: $0.2) }
    }

    /// Серия дней подряд с хотя бы одной попыткой.
    static func streak(_ attempts: [Attempt], now: Date = Date()) -> Int {
        let calendar = Calendar.current
        let days = Set(attempts.map { calendar.startOfDay(for: $0.date) })
        guard !days.isEmpty else { return 0 }
        var streak = 0
        var cursor = calendar.startOfDay(for: now)
        // Если сегодня ещё не занимались, считаем серию от вчера.
        if !days.contains(cursor) {
            cursor = calendar.date(byAdding: .day, value: -1, to: cursor) ?? cursor
        }
        while days.contains(cursor) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
    }

    // MARK: - Утилиты

    private static func share(_ flags: [Bool]) -> Double {
        guard !flags.isEmpty else { return 0 }
        return Double(flags.filter { $0 }.count) / Double(flags.count)
    }

    static func median(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        if sorted.count % 2 == 0 {
            return (sorted[mid - 1] + sorted[mid]) / 2
        }
        return sorted[mid]
    }
}
