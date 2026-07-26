import Foundation

/// Шаблон сценария. Одна карточка = один шаблон; числа подставляются при каждом показе.
protocol TaskTemplate {
    /// Уникальный ID вида `m1.markup_to_margin`. Меняется только при смысловом изменении карточки.
    var id: String { get }
    var moduleID: String { get }
    /// Короткое имя для списков и статистики.
    var title: String { get }
    /// 1…5, задаёт порядок «от простого к сложному» внутри модуля.
    var difficulty: Int { get }
    var correctTool: ToolKind { get }
    /// Ожидается ли счёт без калькулятора. Влияет на базовый лимит времени.
    var isMentalMath: Bool { get }
    /// Инструменты-дистракторы: правдоподобные, но неверные для этого кейса.
    var distractors: [ToolKind] { get }
    /// Базовый лимит на счёт, сек.
    var baseSeconds: Double { get }

    func generate(_ r: Randomizer) -> GeneratedTask
}

extension TaskTemplate {
    var isMentalMath: Bool { true }
    var baseSeconds: Double { isMentalMath ? 45 : 75 }

    /// Собирает 4 варианта инструмента: верный + 3 дистрактора, перемешанные детерминированно.
    func makeOptions(_ r: Randomizer) -> [ToolKind] {
        let pool = distractors.filter { $0 != correctTool }
        let picked = r.sample(pool, count: min(3, pool.count))
        return r.shuffled([correctTool] + picked)
    }

    /// Хелпер для сборки задачи — чтобы шаблоны не повторяли общий код.
    func task(
        _ r: Randomizer,
        scenario: String,
        question: String,
        answer: Double,
        unit: AnswerUnit,
        tolerance: Tolerance? = nil,
        explanation: String,
        mentalTrick: String,
        workings: [String]
    ) -> GeneratedTask {
        GeneratedTask(
            templateID: id,
            moduleID: moduleID,
            seed: r.seed,
            scenario: scenario,
            question: question,
            options: makeOptions(r),
            correctTool: correctTool,
            answer: answer,
            unit: unit,
            tolerance: tolerance ?? unit.defaultTolerance,
            explanation: explanation,
            mentalTrick: mentalTrick,
            workings: workings,
            baseSeconds: baseSeconds
        )
    }
}

/// Заготовка под будущую карточку: описание есть, генератора ещё нет.
/// Используется модулями 3–6 и показывается в UI как «в разработке».
struct TemplateBacklogItem: Identifiable, Hashable {
    let id: String
    let title: String
    let tool: ToolKind
    let difficulty: Int
    /// Набросок сценария — что должно быть в тексте задачи.
    let scenarioSketch: String

    var moduleID: String { tool.moduleID }
}
