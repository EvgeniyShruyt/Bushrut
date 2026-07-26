import Foundation

/// Модуль 5 — «Математика решений». Заготовка: структура и бэклог карточек.
enum Module5Decisions {

    static let templates: [TaskTemplate] = []

    static let pool: [ToolKind] = [
        .expectedValueComparison, .roi, .romi, .costOfDelay,
        .weightedPipeline, .paybackSimple, .scenarioSensitivity
    ]

    static let backlog: [TemplateBacklogItem] = [
        TemplateBacklogItem(
            id: "m5.ev_two_options",
            title: "Сравнение вариантов по expected value",
            tool: .expectedValueComparison,
            difficulty: 2,
            scenarioSketch: """
            Тендер: пойти агрессивной ценой (вероятность 65 %, маржа 11 %) или держать прайс \
            (вероятность 30 %, маржа 27 %). Какой вариант лучше по ожидаемой валовой прибыли.
            """
        ),
        TemplateBacklogItem(
            id: "m5.ev_asymmetric_risk",
            title: "EV при асимметричном риске",
            tool: .expectedValueComparison,
            difficulty: 4,
            scenarioSketch: """
            Крупный контракт с риском штрафа за срыв сроков. Тренируется различение \
            «ожидаемое значение» и «допустимый худший исход» — когда EV не единственный критерий.
            """
        ),
        TemplateBacklogItem(
            id: "m5.roi_basic",
            title: "ROI на пальцах",
            tool: .roi,
            difficulty: 1,
            scenarioSketch: """
            Вложили 3,4 млн в дооснащение сервисного отдела, получили дополнительную \
            валовую прибыль 5,1 млн за год. ROI и почему это не то же самое, что маржа.
            """
        ),
        TemplateBacklogItem(
            id: "m5.romi_campaign",
            title: "ROMI по кампании",
            tool: .romi,
            difficulty: 3,
            scenarioSketch: """
            Кампания на 1,8 млн дала 14,6 млн выручки при марже 28 %. \
            Считать ROMI по выручке или по марже — типовая ошибка в отчётах маркетинга.
            """
        ),
        TemplateBacklogItem(
            id: "m5.cost_of_delay",
            title: "Стоимость месяца промедления",
            tool: .costOfDelay,
            difficulty: 3,
            scenarioSketch: """
            Решение о запуске нового направления откладывается на квартал. \
            Упущенная валовая прибыль плюс сдвиг окупаемости — цена «подумаем ещё месяц».
            """
        ),
        TemplateBacklogItem(
            id: "m5.delay_vs_information",
            title: "Отсрочка ради информации",
            tool: .costOfDelay,
            difficulty: 5,
            scenarioSketch: """
            Ждать данные пилота ещё месяц или решать сейчас: сравнение стоимости отсрочки \
            с ценой ошибочного решения, взвешенной на вероятность ошибки.
            """
        )
    ]
}
