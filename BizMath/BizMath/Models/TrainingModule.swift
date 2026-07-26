import Foundation
import SwiftData

/// Модуль программы: «Маржа, наценка, скидки», «Проценты и дельты в уме» и т.д.
/// Модули 1–2 наполнены карточками, 3–6 существуют как структура с бэклогом шаблонов.
@Model
final class TrainingModule {
    /// Стабильный идентификатор вида `m1`, `m2`, ... — по нему связываются карточки и шаблоны.
    @Attribute(.unique) var id: String
    var order: Int
    var title: String
    var summary: String
    /// SF Symbol для списка модулей.
    var symbolName: String
    /// Есть ли готовый контент. `false` — модуль показывается как заготовка.
    var isContentReady: Bool
    /// Сколько шаблонов запланировано, но ещё не написано (для индикатора «в разработке»).
    var backlogCount: Int

    @Relationship(deleteRule: .cascade, inverse: \Card.module)
    var cards: [Card] = []

    init(
        id: String,
        order: Int,
        title: String,
        summary: String,
        symbolName: String,
        isContentReady: Bool,
        backlogCount: Int
    ) {
        self.id = id
        self.order = order
        self.title = title
        self.summary = summary
        self.symbolName = symbolName
        self.isContentReady = isContentReady
        self.backlogCount = backlogCount
    }
}

extension TrainingModule {
    var activeCards: [Card] { cards.filter(\.isActive) }

    var dueCardsCount: Int {
        let now = Date()
        return activeCards.filter { $0.due <= now }.count
    }

    var newCardsCount: Int {
        activeCards.filter { $0.schedulingState == .new }.count
    }
}
