import Foundation

/// Модуль 6 — «Чтение P&L и KPI». Заготовка: структура и бэклог карточек.
enum Module6PnL {

    static let templates: [TaskTemplate] = []

    static let pool: [ToolKind] = [
        .grossMargin, .ebitdaMargin, .kpiWeighting,
        .weightedAverage, .breakEvenRevenue, .contributionMargin, .roi
    ]

    static let backlog: [TemplateBacklogItem] = [
        TemplateBacklogItem(
            id: "m6.gross_margin_scan",
            title: "Валовая маржа за 10 секунд",
            tool: .grossMargin,
            difficulty: 1,
            scenarioSketch: """
            Фрагмент управленческого P&L: выручка, себестоимость, коммерческие, административные. \
            Назвать валовую маржу, не считая всё подряд — тренируется скан отчёта, а не арифметика.
            """
        ),
        TemplateBacklogItem(
            id: "m6.ebitda_margin_scan",
            title: "Маржа по EBITDA за 10 секунд",
            tool: .ebitdaMargin,
            difficulty: 2,
            scenarioSketch: """
            Тот же отчёт: отделить амортизацию и проценты, получить EBITDA и маржу по ней. \
            Ключ — что именно не входит в EBITDA.
            """
        ),
        TemplateBacklogItem(
            id: "m6.margin_bridge",
            title: "Почему маржа упала",
            tool: .grossMargin,
            difficulty: 4,
            scenarioSketch: """
            Валовая маржа упала с 31 % до 27 % при росте выручки. Разложить на два эффекта: \
            сдвиг микса продуктов и рост скидок — какой из них главный.
            """
        ),
        TemplateBacklogItem(
            id: "m6.ebitda_vs_cash",
            title: "EBITDA есть, денег нет",
            tool: .ebitdaMargin,
            difficulty: 5,
            scenarioSketch: """
            Прибыльный по P&L квартал с отрицательным денежным потоком из-за роста дебиторки и склада. \
            Тренируется распознавание: когда вопрос вообще не к P&L.
            """
        ),
        TemplateBacklogItem(
            id: "m6.kpi_weights",
            title: "Веса в бонусной схеме",
            tool: .kpiWeighting,
            difficulty: 3,
            scenarioSketch: """
            Бонус РОПа: 60 % за выручку, 40 % за маржу. Посчитать выплату по фактам \
            и понять, какое поведение эта схема покупает.
            """
        ),
        TemplateBacklogItem(
            id: "m6.kpi_reweighting",
            title: "Что изменится при смене весов",
            tool: .kpiWeighting,
            difficulty: 5,
            scenarioSketch: """
            Переносим вес с выручки на маржу (30/70). На сколько изменится выплата при тех же фактах \
            и какую сделку менеджер теперь не приведёт.
            """
        )
    ]
}
