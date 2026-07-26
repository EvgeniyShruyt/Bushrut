import Foundation
import SwiftData

/// Настройки приложения. В хранилище всегда ровно одна запись (`ensure(in:)`).
@Model
final class AppSettings {
    @Attribute(.unique) var singletonKey: String
    /// Целевая вероятность вспоминания для FSRS. 0.9 — стандарт.
    var desiredRetention: Double
    /// Максимум новых карточек за день.
    var newCardsPerDay: Int
    /// Максимум карточек в одной сессии.
    var sessionSize: Int
    /// Включён ли таймер на счёт вообще.
    var timerEnabled: Bool
    /// Сколько чистых попыток нужно, прежде чем на карточке включится лимит времени.
    var untimedWarmupAttempts: Int
    var lastNewCardsDate: Date?
    var newCardsIssuedToday: Int

    init(
        desiredRetention: Double = 0.90,
        newCardsPerDay: Int = 5,
        sessionSize: Int = 12,
        timerEnabled: Bool = true,
        untimedWarmupAttempts: Int = 3
    ) {
        self.singletonKey = "settings"
        self.desiredRetention = desiredRetention
        self.newCardsPerDay = newCardsPerDay
        self.sessionSize = sessionSize
        self.timerEnabled = timerEnabled
        self.untimedWarmupAttempts = untimedWarmupAttempts
        self.lastNewCardsDate = nil
        self.newCardsIssuedToday = 0
    }
}

extension AppSettings {
    @MainActor
    static func ensure(in context: ModelContext) -> AppSettings {
        let descriptor = FetchDescriptor<AppSettings>()
        if let existing = try? context.fetch(descriptor), let first = existing.first {
            return first
        }
        let settings = AppSettings()
        context.insert(settings)
        try? context.save()
        return settings
    }

    /// Сбрасывает дневной счётчик новых карточек при смене календарного дня.
    func rollDailyCounterIfNeeded(now: Date = Date(), calendar: Calendar = .current) {
        guard let last = lastNewCardsDate else {
            lastNewCardsDate = now
            newCardsIssuedToday = 0
            return
        }
        if !calendar.isDate(last, inSameDayAs: now) {
            lastNewCardsDate = now
            newCardsIssuedToday = 0
        }
    }

    var remainingNewToday: Int {
        max(0, newCardsPerDay - newCardsIssuedToday)
    }
}
