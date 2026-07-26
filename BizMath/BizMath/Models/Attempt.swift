import Foundation
import SwiftData

/// Одна попытка по карточке: что было сгенерировано, что выбрал пользователь, сколько времени занял каждый шаг.
///
/// `seed` хранится, чтобы задачу можно было воспроизвести бит-в-бит (разбор ошибок, экспорт).
@Model
final class Attempt {
    var id: UUID
    var date: Date
    var templateID: String
    var moduleID: String
    /// Битовый паттерн UInt64-сида: SwiftData не хранит UInt64 напрямую.
    var seedBits: Int64

    // Шаг 1 — выбор инструмента
    var chosenToolRaw: String?
    var correctToolRaw: String
    var toolCorrect: Bool
    var classifySeconds: Double

    // Шаг 2 — расчёт
    var answerGiven: Double?
    var answerExpected: Double
    var answerCorrect: Bool
    var computeSeconds: Double
    var timeLimitSeconds: Double?
    var withinTimeLimit: Bool

    // Итог
    var ratingRaw: Int
    /// Интервал до следующего показа, дни (для графика нагрузки).
    var scheduledIntervalDays: Double

    var card: Card?

    init(
        date: Date,
        templateID: String,
        moduleID: String,
        seed: UInt64,
        chosenTool: ToolKind?,
        correctTool: ToolKind,
        classifySeconds: Double,
        answerGiven: Double?,
        answerExpected: Double,
        answerCorrect: Bool,
        computeSeconds: Double,
        timeLimitSeconds: Double?,
        rating: FSRSRating,
        scheduledIntervalDays: Double
    ) {
        self.id = UUID()
        self.date = date
        self.templateID = templateID
        self.moduleID = moduleID
        self.seedBits = Int64(bitPattern: seed)
        self.chosenToolRaw = chosenTool?.rawValue
        self.correctToolRaw = correctTool.rawValue
        self.toolCorrect = chosenTool == correctTool
        self.classifySeconds = classifySeconds
        self.answerGiven = answerGiven
        self.answerExpected = answerExpected
        self.answerCorrect = answerCorrect
        self.computeSeconds = computeSeconds
        self.timeLimitSeconds = timeLimitSeconds
        self.withinTimeLimit = timeLimitSeconds.map { computeSeconds <= $0 } ?? true
        self.ratingRaw = rating.rawValue
        self.scheduledIntervalDays = scheduledIntervalDays
    }
}

extension Attempt {
    var seed: UInt64 { UInt64(bitPattern: seedBits) }
    var rating: FSRSRating { FSRSRating(rawValue: ratingRaw) ?? .good }
    var chosenTool: ToolKind? { chosenToolRaw.flatMap(ToolKind.init(rawValue:)) }
    var correctTool: ToolKind { ToolKind(rawValue: correctToolRaw) ?? .markupToMargin }
    /// Полностью чистая попытка: и инструмент, и число, и в лимит уложился.
    var isClean: Bool { toolCorrect && answerCorrect && withinTimeLimit }
}
