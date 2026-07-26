import Foundation
import SwiftData

/// Синхронизирует хранилище с кодом: создаёт недостающие модули и карточки,
/// обновляет метаданные и деактивирует карточки, чей шаблон исчез.
///
/// Вызывается при каждом запуске — так добавление новых шаблонов в модули 3–6
/// подхватывается без миграций и без потери прогресса по существующим карточкам.
enum ContentSeeder {

    @MainActor
    static func sync(context: ModelContext) {
        let modules = syncModules(context: context)
        syncCards(context: context, modules: modules)
        try? context.save()
    }

    @MainActor
    private static func syncModules(context: ModelContext) -> [String: TrainingModule] {
        let existing = (try? context.fetch(FetchDescriptor<TrainingModule>())) ?? []
        var byID = Dictionary(existing.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

        for descriptor in ModuleCatalog.all {
            let templateCount = TemplateRegistry.templates(moduleID: descriptor.id).count
            let backlogCount = TemplateRegistry.backlogCount(moduleID: descriptor.id)

            if let module = byID[descriptor.id] {
                module.order = descriptor.order
                module.title = descriptor.title
                module.summary = descriptor.summary
                module.symbolName = descriptor.symbolName
                module.isContentReady = templateCount > 0
                module.backlogCount = backlogCount
            } else {
                let module = TrainingModule(
                    id: descriptor.id,
                    order: descriptor.order,
                    title: descriptor.title,
                    summary: descriptor.summary,
                    symbolName: descriptor.symbolName,
                    isContentReady: templateCount > 0,
                    backlogCount: backlogCount
                )
                context.insert(module)
                byID[descriptor.id] = module
            }
        }
        return byID
    }

    @MainActor
    private static func syncCards(context: ModelContext, modules: [String: TrainingModule]) {
        let existing = (try? context.fetch(FetchDescriptor<Card>())) ?? []
        var byTemplateID = Dictionary(existing.map { ($0.templateID, $0) }, uniquingKeysWith: { first, _ in first })
        var seenIDs = Set<String>()

        for descriptor in ModuleCatalog.all {
            let templates = TemplateRegistry.templates(moduleID: descriptor.id)
            for (index, template) in templates.enumerated() {
                seenIDs.insert(template.id)
                if let card = byTemplateID[template.id] {
                    // Прогресс и расписание не трогаем — обновляем только описание.
                    card.title = template.title
                    card.difficulty = template.difficulty
                    card.toolRaw = template.correctTool.rawValue
                    card.isMentalMath = template.isMentalMath
                    card.order = index
                    card.isActive = true
                    if card.module == nil { card.module = modules[descriptor.id] }
                } else {
                    let card = Card(
                        templateID: template.id,
                        moduleID: template.moduleID,
                        title: template.title,
                        difficulty: template.difficulty,
                        toolRaw: template.correctTool.rawValue,
                        isMentalMath: template.isMentalMath,
                        order: index
                    )
                    card.module = modules[descriptor.id]
                    context.insert(card)
                    byTemplateID[template.id] = card
                }
            }
        }

        // Шаблон удалён из кода — карточку не удаляем (история попыток ценнее), но выключаем.
        for card in existing where !seenIDs.contains(card.templateID) {
            card.isActive = false
        }
    }
}
