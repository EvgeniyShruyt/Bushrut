import Foundation
import SwiftData

/// Отбор карточек в сессию: сначала просроченные по FSRS, затем — новые в пределах дневного лимита.
enum ReviewScheduler {

    struct Queue {
        var cards: [Card]
        var dueCount: Int
        var newCount: Int
        var isEmpty: Bool { cards.isEmpty }
    }

    static func buildQueue(
        context: ModelContext,
        settings: AppSettings,
        moduleID: String? = nil,
        now: Date = Date()
    ) -> Queue {
        settings.rollDailyCounterIfNeeded(now: now)

        let all = (try? context.fetch(FetchDescriptor<Card>())) ?? []
        let pool = all.filter { card in
            card.isActive
                && TemplateRegistry.template(id: card.templateID) != nil
                && (moduleID == nil || card.moduleID == moduleID)
        }

        // Просроченные — по возрастанию due: самое «протухшее» вперёд.
        let due = pool
            .filter { $0.schedulingState != .new && $0.due <= now }
            .sorted { $0.due < $1.due }

        // Новые — в порядке модулей и сложности, чтобы шло от простого к сложному.
        let fresh = pool
            .filter { $0.schedulingState == .new }
            .sorted { lhs, rhs in
                if lhs.moduleID != rhs.moduleID { return lhs.moduleID < rhs.moduleID }
                if lhs.difficulty != rhs.difficulty { return lhs.difficulty < rhs.difficulty }
                return lhs.order < rhs.order
            }

        let newAllowance = min(settings.remainingNewToday, max(0, settings.sessionSize - due.count))
        let selectedNew = Array(fresh.prefix(newAllowance))
        let selectedDue = Array(due.prefix(settings.sessionSize))

        // Перемешиваем так, чтобы новые не шли сплошным блоком в конце.
        let merged = interleave(due: selectedDue, new: selectedNew)

        return Queue(
            cards: Array(merged.prefix(settings.sessionSize)),
            dueCount: selectedDue.count,
            newCount: selectedNew.count
        )
    }

    /// Сколько карточек ждёт прямо сейчас — для бейджа на вкладке.
    static func dueCount(context: ModelContext, now: Date = Date()) -> Int {
        let all = (try? context.fetch(FetchDescriptor<Card>())) ?? []
        return all.filter { $0.isActive && $0.schedulingState != .new && $0.due <= now }.count
    }

    /// Прогноз нагрузки на ближайшие дни: сколько карточек придёт на повторение.
    static func forecast(context: ModelContext, days: Int = 14, now: Date = Date()) -> [(date: Date, count: Int)] {
        let calendar = Calendar.current
        let all = (try? context.fetch(FetchDescriptor<Card>())) ?? []
        let active = all.filter { $0.isActive && $0.schedulingState != .new }
        let startOfToday = calendar.startOfDay(for: now)

        return (0..<days).map { offset in
            let day = calendar.date(byAdding: .day, value: offset, to: startOfToday) ?? startOfToday
            let count = active.filter { calendar.isDate($0.due, inSameDayAs: day) || (offset == 0 && $0.due < day) }.count
            return (day, count)
        }
    }

    private static func interleave(due: [Card], new: [Card]) -> [Card] {
        guard !new.isEmpty else { return due }
        guard !due.isEmpty else { return new }
        var result: [Card] = []
        let gap = max(1, due.count / new.count)
        var newIterator = new.makeIterator()
        var pending = newIterator.next()

        for (index, card) in due.enumerated() {
            result.append(card)
            if (index + 1) % gap == 0, let next = pending {
                result.append(next)
                pending = newIterator.next()
            }
        }
        while let next = pending {
            result.append(next)
            pending = newIterator.next()
        }
        return result
    }
}
