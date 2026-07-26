import Foundation

/// Модуль 3 — «Деньги во времени». Заготовка: структура и бэклог карточек.
///
/// Чтобы наполнить модуль, добавьте шаблоны в `templates` — `ContentSeeder` создаст
/// карточки при следующем запуске, а соответствующие пункты бэклога исчезнут из UI
/// автоматически (сопоставление идёт по `id`).
enum Module3TimeValue {

    static let templates: [TaskTemplate] = []

    static let pool: [ToolKind] = [
        .discounting, .paybackSimple, .paybackDiscounted, .workingCapital,
        .cashConversionCycle, .roi, .costOfDelay, .breakEvenRevenue
    ]

    static let backlog: [TemplateBacklogItem] = [
        TemplateBacklogItem(
            id: "m3.discount_intuition",
            title: "Что значит ставка дисконта",
            tool: .discounting,
            difficulty: 1,
            scenarioSketch: """
            Клиент просит отсрочку 6 месяцев на платёж 4,8 млн ₽ при стоимости денег 22 % годовых. \
            Сколько этот платёж стоит в сегодняшних деньгах и какую скидку за предоплату \
            вы можете дать, не потеряв. Без вывода NPV — только «во что превращается будущий рубль».
            """
        ),
        TemplateBacklogItem(
            id: "m3.discount_when_it_matters",
            title: "Когда дисконтирование меняет решение",
            tool: .discounting,
            difficulty: 3,
            scenarioSketch: """
            Два контракта с одинаковой суммой, но разным графиком платежей (аванс против оплаты \
            по факту через год). Тренируется распознавание: когда разница в графике важнее разницы в цене.
            """
        ),
        TemplateBacklogItem(
            id: "m3.payback_simple",
            title: "Простой срок окупаемости",
            tool: .paybackSimple,
            difficulty: 2,
            scenarioSketch: """
            Инвестиции в собственный склад 14,6 млн ₽, экономия на логистике 890 тыс. ₽/мес. \
            За сколько месяцев вернётся вложение без учёта стоимости денег.
            """
        ),
        TemplateBacklogItem(
            id: "m3.payback_discounted",
            title: "Дисконтированная окупаемость",
            tool: .paybackDiscounted,
            difficulty: 4,
            scenarioSketch: """
            Тот же склад при ставке 24 % годовых: насколько удлиняется срок окупаемости \
            и в какой момент разница становится решающей для решения «строим / арендуем».
            """
        ),
        TemplateBacklogItem(
            id: "m3.working_capital",
            title: "Сколько денег заморожено в обороте",
            tool: .workingCapital,
            difficulty: 3,
            scenarioSketch: """
            Рост выручки на 35 % при отсрочке клиентам 45 дней и складе 60 дней: \
            сколько дополнительных денег придётся вынуть из оборота, чтобы этот рост профинансировать.
            """
        ),
        TemplateBacklogItem(
            id: "m3.cash_conversion_cycle",
            title: "Cash conversion cycle",
            tool: .cashConversionCycle,
            difficulty: 4,
            scenarioSketch: """
            DSO 52 дня, DIO 64 дня, DPO 31 день. Сколько дней компания кредитует рынок \
            и что даст переговорная победа «+15 дней отсрочки от поставщика» в деньгах.
            """
        ),
        TemplateBacklogItem(
            id: "m3.prepay_discount_tradeoff",
            title: "Скидка за предоплату против стоимости денег",
            tool: .discounting,
            difficulty: 5,
            scenarioSketch: """
            Клиент готов платить авансом за скидку 4 %, отсрочка по договору — 60 дней. \
            Выгодно ли это при текущей стоимости денег: сравнение годовой доходности скидки со ставкой.
            """
        )
    ]
}
