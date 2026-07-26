import Foundation

/// Модуль 4 — «Прогноз и воронка». Заготовка: структура и бэклог карточек.
enum Module4Forecast {

    static let templates: [TaskTemplate] = []

    static let pool: [ToolKind] = [
        .weightedPipeline, .funnelChain, .scenarioSensitivity,
        .expectedValueComparison, .weightedAverage, .percentagePoints, .compoundGrowth
    ]

    static let backlog: [TemplateBacklogItem] = [
        TemplateBacklogItem(
            id: "m4.weighted_pipeline",
            title: "Взвешенный прогноз пайплайна",
            tool: .weightedPipeline,
            difficulty: 2,
            scenarioSketch: """
            Пять сделок с суммами и вероятностями (18,4 млн × 30 %, 6,2 млн × 70 % и т.д.). \
            Сколько реально ставить в прогноз квартала и почему сумма «горячих» — не ответ.
            """
        ),
        TemplateBacklogItem(
            id: "m4.pipeline_coverage",
            title: "Достаточность пайплайна под план",
            tool: .weightedPipeline,
            difficulty: 3,
            scenarioSketch: """
            План квартала 96 млн, взвешенный пайплайн 71 млн. Сколько новых сделок какого \
            размера нужно завести в воронку с учётом длины цикла.
            """
        ),
        TemplateBacklogItem(
            id: "m4.funnel_chain",
            title: "Цепочка конверсий",
            tool: .funnelChain,
            difficulty: 2,
            scenarioSketch: """
            Лид → квалификация 42 % → демо 55 % → КП 61 % → сделка 34 %. \
            Сколько лидов нужно на входе для 12 сделок в месяц.
            """
        ),
        TemplateBacklogItem(
            id: "m4.funnel_bottleneck",
            title: "Где чинить воронку",
            tool: .funnelChain,
            difficulty: 4,
            scenarioSketch: """
            Два варианта улучшения: +8 п.п. на этапе с конверсией 42 % или +8 п.п. на этапе с 34 %. \
            Какой даёт больше сделок — тренировка мультипликативного эффекта.
            """
        ),
        TemplateBacklogItem(
            id: "m4.scenario_conversion_drop",
            title: "Что если конверсия упадёт на 5 п.п.",
            tool: .scenarioSensitivity,
            difficulty: 3,
            scenarioSketch: """
            Просадка конверсии финального этапа на 5 п.п. при неизменном трафике: \
            на сколько процентов падает выручка квартала и хватает ли запаса до точки безубыточности.
            """
        ),
        TemplateBacklogItem(
            id: "m4.scenario_three_cases",
            title: "Три сценария плана",
            tool: .scenarioSensitivity,
            difficulty: 5,
            scenarioSketch: """
            Пессимистичный / базовый / оптимистичный по двум параметрам сразу (конверсия и средний чек). \
            Какой параметр чувствительнее — на нём и надо держать управленческое внимание.
            """
        )
    ]
}
