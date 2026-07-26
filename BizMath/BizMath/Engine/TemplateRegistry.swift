import Foundation

/// Единая точка доступа ко всем шаблонам и бэклогу.
enum TemplateRegistry {

    static let all: [TaskTemplate] =
        Module1Margin.templates
        + Module2Percents.templates
        + Module3TimeValue.templates
        + Module4Forecast.templates
        + Module5Decisions.templates
        + Module6PnL.templates

    static let allBacklog: [TemplateBacklogItem] =
        Module3TimeValue.backlog
        + Module4Forecast.backlog
        + Module5Decisions.backlog
        + Module6PnL.backlog

    private static let byID: [String: TaskTemplate] = {
        Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }()

    static func template(id: String) -> TaskTemplate? { byID[id] }

    static func templates(moduleID: String) -> [TaskTemplate] {
        all.filter { $0.moduleID == moduleID }.sorted { $0.difficulty < $1.difficulty }
    }

    /// Пункты бэклога, для которых шаблон ещё не написан.
    static func backlog(moduleID: String) -> [TemplateBacklogItem] {
        allBacklog
            .filter { $0.moduleID == moduleID && byID[$0.id] == nil }
            .sorted { $0.difficulty < $1.difficulty }
    }

    static func backlogCount(moduleID: String) -> Int {
        backlog(moduleID: moduleID).count
    }

    /// Генерирует задачу по шаблону карточки. Сид — либо новый, либо переданный (разбор ошибки).
    static func generate(templateID: String, seed: UInt64? = nil) -> GeneratedTask? {
        guard let template = byID[templateID] else { return nil }
        let actualSeed = seed ?? UInt64.random(in: 1...UInt64.max)
        return template.generate(Randomizer(seed: actualSeed))
    }
}
