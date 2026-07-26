import Foundation

/// Модуль 1 — «Маржа, наценка, скидки». Стартовый набор карточек, от простого к сложному.
enum Module1Margin {

    static let templates: [TaskTemplate] = [
        MarkupToMargin(),
        MarginToMarkup(),
        DiscountMarginErosion(),
        VolumeCompensation(),
        BreakEvenUnits(),
        BreakEvenRevenue(),
        MaxDiscountAtTargetMargin(),
        CascadedDiscounts()
    ]

    /// Общий пул дистракторов модуля — все варианты реальные, но к конкретному кейсу не подходят.
    static let pool: [ToolKind] = [
        .markupToMargin, .marginToMarkup, .discountMarginErosion, .volumeCompensation,
        .maxDiscountAtTargetMargin, .breakEvenUnits, .breakEvenRevenue,
        .contributionMargin, .cascadedDiscounts, .weightedAverage, .grossMargin
    ]

    static let categories = [
        "промышленных фильтров", "серверных стоек", "упаковочной плёнки",
        "кабельной продукции", "лабораторных реагентов", "гидравлических насосов",
        "складских стеллажей", "промышленных подшипников"
    ]

    static let customers = [
        "федеральной сети", "производственного холдинга", "дистрибьютора в СЗФО",
        "монтажной компании", "закупщика металлотрейдера", "тендерного отдела заказчика"
    ]
}

// MARK: - 1.1 Наценка → маржа

private struct MarkupToMargin: TaskTemplate {
    let id = "m1.markup_to_margin"
    let moduleID = ModuleCatalog.margin
    let title = "Наценка → маржа"
    let difficulty = 1
    let correctTool: ToolKind = .markupToMargin
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 40

    func generate(_ r: Randomizer) -> GeneratedTask {
        let cost = r.money(680...4_900, step: 10)
        let markup = r.percent(22...68, step: 1)
        let price = cost * (1 + markup / 100)
        let profit = price - cost
        let margin = markup / (100 + markup) * 100
        let category = r.pick(Module1Margin.categories)

        return task(
            r,
            scenario: """
            Категорийный менеджер по линейке \(category) отчитывается: «Берём по \(Fmt.rub(cost)), \
            работаем с наценкой \(Fmt.pct(markup, digits: 0)) — маржа отличная».
            На следующей неделе вы защищаете бюджет, и в P&L маржа считается от выручки.
            """,
            question: "Какая валовая маржа получается в процентах от выручки?",
            answer: margin,
            unit: .percent,
            explanation: """
            Наценка считается от закупа, маржа — от цены продажи. База разная, поэтому маржа \
            всегда меньше наценки. Разрыв растёт нелинейно: при наценке 100 % маржа всего 50 %.
            """,
            mentalTrick: "Маржа = наценка / (100 + наценка). Наценка \(Fmt.pct(markup, digits: 0)) → \(Fmt.number(markup, digits: 0))/\(Fmt.number(100 + markup, digits: 0)).",
            workings: [
                "Цена продажи = \(Fmt.rub(cost)) × \(Fmt.number(1 + markup / 100, digits: 2)) = \(Fmt.rub(price))",
                "Валовая прибыль = \(Fmt.rub(profit))",
                "\(Fmt.rub(profit)) / \(Fmt.rub(price)) = \(Fmt.pct(margin))"
            ]
        )
    }
}

// MARK: - 1.2 Маржа → наценка

private struct MarginToMarkup: TaskTemplate {
    let id = "m1.margin_to_markup"
    let moduleID = ModuleCatalog.margin
    let title = "Маржа → наценка"
    let difficulty = 1
    let correctTool: ToolKind = .marginToMarkup
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 45

    func generate(_ r: Randomizer) -> GeneratedTask {
        let cost = r.money(1_100...7_400, step: 10)
        let margin = r.percent(18...44, step: 1)
        let markup = margin / (100 - margin) * 100
        let price = cost / (1 - margin / 100)
        let category = r.pick(Module1Margin.categories)

        return task(
            r,
            scenario: """
            Собственник зафиксировал план: валовая маржа по направлению \(category) — \
            не ниже \(Fmt.pct(margin, digits: 0)). Закуп по позиции — \(Fmt.rub(cost)).
            Прайс на следующий квартал вы отдаёте в понедельник.
            """,
            question: "Какую наценку на закуп нужно поставить в прайсе?",
            answer: markup,
            unit: .percent,
            explanation: """
            Обратный ход к переводу наценки в маржу: делим не на цену, а на закуп. \
            Целевая маржа \(Fmt.pct(margin, digits: 0)) всегда требует наценки больше, чем сама маржа.
            """,
            mentalTrick: "Наценка = маржа / (100 − маржа). \(Fmt.number(margin, digits: 0))/\(Fmt.number(100 - margin, digits: 0)).",
            workings: [
                "Цена = \(Fmt.rub(cost)) / (1 − \(Fmt.number(margin / 100, digits: 2))) = \(Fmt.rub(price))",
                "Наценка = (\(Fmt.rub(price)) − \(Fmt.rub(cost))) / \(Fmt.rub(cost))",
                "= \(Fmt.pct(markup))"
            ]
        )
    }
}

// MARK: - 1.3 Скидка съедает маржу

private struct DiscountMarginErosion: TaskTemplate {
    let id = "m1.discount_margin_erosion"
    let moduleID = ModuleCatalog.margin
    let title = "Скидка съедает маржу"
    let difficulty = 2
    let correctTool: ToolKind = .discountMarginErosion
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 50

    func generate(_ r: Randomizer) -> GeneratedTask {
        let margin = r.percent(26...44, step: 1)
        let discount = r.percent(4...min(14, margin - 8), step: 1)
        let newMargin = (margin - discount) / (100 - discount) * 100
        let drop = margin - newMargin
        let customer = r.pick(Module1Margin.customers)

        return task(
            r,
            scenario: """
            На переговорах закупщик \(customer) давит: «Дайте \(Fmt.pct(discount, digits: 0)) — \
            и подписываем сегодня». Текущая валовая маржа по этой позиции — \(Fmt.pct(margin, digits: 0)).
            Ответ нужен в переговорной, без калькулятора.
            """,
            question: "Какая валовая маржа останется после скидки?",
            answer: newMargin,
            unit: .percent,
            explanation: """
            Скидка забирает деньги из прибыли целиком: себестоимость не двигается. \
            При этом падает и выручка, поэтому маржа в процентах проседает сильнее, \
            чем на размер скидки в абсолютных деньгах.
            """,
            mentalTrick: "Новая маржа = (маржа − скидка) / (100 − скидка). Прибыль минус \(Fmt.number(discount, digits: 0)), выручка тоже минус \(Fmt.number(discount, digits: 0)).",
            workings: [
                "Было: цена 100, прибыль \(Fmt.number(margin, digits: 0))",
                "Стало: цена \(Fmt.number(100 - discount, digits: 0)), прибыль \(Fmt.number(margin - discount, digits: 0))",
                "\(Fmt.number(margin - discount, digits: 0)) / \(Fmt.number(100 - discount, digits: 0)) = \(Fmt.pct(newMargin)) — минус \(Fmt.number(drop)) п.п."
            ]
        )
    }
}

// MARK: - 1.4 Компенсация скидки объёмом

private struct VolumeCompensation: TaskTemplate {
    let id = "m1.volume_compensation"
    let moduleID = ModuleCatalog.margin
    let title = "Компенсация скидки объёмом"
    let difficulty = 3
    let correctTool: ToolKind = .volumeCompensation
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 55

    func generate(_ r: Randomizer) -> GeneratedTask {
        let margin = r.percent(24...40, step: 1)
        let discount = r.percent(3...min(12, margin - 8), step: 1)
        let growth = discount / (margin - discount) * 100
        let customer = r.pick(Module1Margin.customers)

        return task(
            r,
            scenario: """
            Коммерческий директор предлагает: «Дадим \(Fmt.pct(discount, digits: 0)) закупщику \(customer) — \
            зато он увеличит объём». Маржа по направлению — \(Fmt.pct(margin, digits: 0)).
            Вам нужно понять, какой рост объёма делает эту сделку хотя бы не хуже текущей.
            """,
            question: "На сколько процентов должен вырасти объём, чтобы валовая прибыль не упала?",
            answer: growth,
            unit: .percent,
            tolerance: .relative(0.04),
            explanation: """
            Скидка бьёт по марже на единицу, а объём должен компенсировать её остатком. \
            Чем тоньше маржа, тем безумнее требуемый рост: при марже вдвое выше скидки нужно \
            удвоение объёма.
            """,
            mentalTrick: "Рост = скидка / (маржа − скидка) = \(Fmt.number(discount, digits: 0)) / \(Fmt.number(margin - discount, digits: 0)).",
            workings: [
                "Маржа на единицу была \(Fmt.number(margin, digits: 0)), стала \(Fmt.number(margin - discount, digits: 0))",
                "Нужно вернуть \(Fmt.number(margin, digits: 0)) прибыли новой маржой \(Fmt.number(margin - discount, digits: 0))",
                "\(Fmt.number(margin, digits: 0)) / \(Fmt.number(margin - discount, digits: 0)) = \(Fmt.number(margin / (margin - discount), digits: 2))× объёма → рост \(Fmt.pct(growth))"
            ]
        )
    }
}

// MARK: - 1.5 Безубыточность в штуках

private struct BreakEvenUnits: TaskTemplate {
    let id = "m1.break_even_units"
    let moduleID = ModuleCatalog.margin
    let title = "Безубыточность в штуках"
    let difficulty = 3
    let correctTool: ToolKind = .breakEvenUnits
    let distractors = Module1Margin.pool
    let isMentalMath = false
    let baseSeconds: Double = 70

    func generate(_ r: Randomizer) -> GeneratedTask {
        let fixed = r.money(1_180_000...4_640_000, step: 10_000)
        let price = r.money(8_900...24_900, step: 100)
        let marginPct = r.percent(22...42, step: 1)
        let variable = (price * (1 - marginPct / 100) / 10).rounded() * 10
        let contribution = price - variable
        let units = (fixed / contribution).rounded(.up)
        let category = r.pick(Module1Margin.categories)

        return task(
            r,
            scenario: """
            Запускаете отдельное направление по продаже \(category). Постоянные затраты — \
            \(Fmt.rub(fixed)) в месяц (аренда, ФОТ отдела, склад). Цена продажи — \(Fmt.rub(price)), \
            переменные затраты на единицу — \(Fmt.rub(variable)).
            На совете директоров спросят, с какого объёма направление перестаёт быть убыточным.
            """,
            question: "Сколько единиц в месяц нужно продать, чтобы выйти в ноль?",
            answer: units,
            unit: .units,
            tolerance: .relative(0.02),
            explanation: """
            Каждая проданная единица приносит маржинальный вклад — разницу цены и переменных затрат. \
            Постоянные затраты гасятся именно этими вкладами, а не выручкой.
            """,
            mentalTrick: "Вклад с единицы = \(Fmt.rub(contribution)). Делим постоянные на вклад — и округляем вверх.",
            workings: [
                "Маржинальный вклад = \(Fmt.rub(price)) − \(Fmt.rub(variable)) = \(Fmt.rub(contribution))",
                "\(Fmt.rub(fixed)) / \(Fmt.rub(contribution)) = \(Fmt.number(fixed / contribution))",
                "Округляем вверх: \(Fmt.units(units))"
            ]
        )
    }
}

// MARK: - 1.6 Безубыточность в выручке

private struct BreakEvenRevenue: TaskTemplate {
    let id = "m1.break_even_revenue"
    let moduleID = ModuleCatalog.margin
    let title = "Безубыточность в выручке"
    let difficulty = 3
    let correctTool: ToolKind = .breakEvenRevenue
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 60

    func generate(_ r: Randomizer) -> GeneratedTask {
        let fixed = r.money(2_140_000...6_820_000, step: 10_000)
        let cm = r.percent(24...44, step: 1)
        let revenue = fixed / (cm / 100)

        return task(
            r,
            scenario: """
            У филиала смешанный ассортимент — считать в штуках бессмысленно. \
            Постоянные затраты филиала — \(Fmt.rub(fixed)) в месяц, средняя маржинальность \
            портфеля — \(Fmt.pct(cm, digits: 0)).
            Директор филиала просит план продаж на месяц «хотя бы в ноль».
            """,
            question: "Какая месячная выручка выводит филиал в ноль?",
            answer: revenue,
            unit: .rubles,
            tolerance: .relative(0.02),
            explanation: """
            Когда номенклатура разная, точка безубыточности живёт в выручке, а не в штуках. \
            Маржинальность портфеля показывает, какая доля каждого рубля выручки идёт на \
            покрытие постоянных затрат.
            """,
            mentalTrick: "Выручка = постоянные / маржинальность. \(Fmt.pct(cm, digits: 0)) → делим на 0,\(Int(cm)).",
            workings: [
                "Каждый рубль выручки даёт \(Fmt.number(cm / 100, digits: 2)) ₽ на покрытие",
                "\(Fmt.rub(fixed)) / \(Fmt.number(cm / 100, digits: 2)) = \(Fmt.rub(revenue))",
                "Это ≈ \(Fmt.mln(revenue)) в месяц"
            ]
        )
    }
}

// MARK: - 1.7 Предельная скидка под целевую маржу

private struct MaxDiscountAtTargetMargin: TaskTemplate {
    let id = "m1.max_discount_target_margin"
    let moduleID = ModuleCatalog.margin
    let title = "Предельная скидка"
    let difficulty = 4
    let correctTool: ToolKind = .maxDiscountAtTargetMargin
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 65

    func generate(_ r: Randomizer) -> GeneratedTask {
        let margin = r.percent(30...48, step: 1)
        let floor = r.percent(14...(margin - 10), step: 1)
        let maxDiscount = (1 - (1 - margin / 100) / (1 - floor / 100)) * 100
        let customer = r.pick(Module1Margin.customers)

        return task(
            r,
            scenario: """
            Тендер \(customer). Стартовая маржа по лоту — \(Fmt.pct(margin, digits: 0)), \
            финансовый комитет разрешил опускаться до маржи \(Fmt.pct(floor, digits: 0)) — ниже сделка не проходит.
            Торг идёт вживую, шаг за шагом, и вам нужен потолок скидки до начала.
            """,
            question: "Какую максимальную скидку от прайса вы можете дать?",
            answer: maxDiscount,
            unit: .percent,
            tolerance: .absolute(0.8),
            explanation: """
            Себестоимость зафиксирована — двигается только цена. Скидка ограничена тем, \
            насколько цена может упасть, пока себестоимость не превысит разрешённую долю выручки.
            """,
            mentalTrick: "Скидка = 1 − (1 − маржа) / (1 − минимальная маржа) = 1 − \(Fmt.number((100 - margin) / 100, digits: 2))/\(Fmt.number((100 - floor) / 100, digits: 2)).",
            workings: [
                "Цена 100 → себестоимость \(Fmt.number(100 - margin, digits: 0))",
                "При марже \(Fmt.pct(floor, digits: 0)) себестоимость = \(Fmt.number(100 - floor, digits: 0)) % цены → цена = \(Fmt.number((100 - margin) / (1 - floor / 100), digits: 1))",
                "Падение со 100 до \(Fmt.number((100 - margin) / (1 - floor / 100), digits: 1)) = скидка \(Fmt.pct(maxDiscount))"
            ]
        )
    }
}

// MARK: - 1.8 Каскад скидок

private struct CascadedDiscounts: TaskTemplate {
    let id = "m1.cascaded_discounts"
    let moduleID = ModuleCatalog.margin
    let title = "Каскад скидок"
    let difficulty = 4
    let correctTool: ToolKind = .cascadedDiscounts
    let distractors = Module1Margin.pool
    let baseSeconds: Double = 55

    func generate(_ r: Randomizer) -> GeneratedTask {
        let base = r.percent(8...18, step: 1)
        let promo = r.percent(4...10, step: 1)
        let volume = r.percent(2...6, step: 1)
        let residual = (1 - base / 100) * (1 - promo / 100) * (1 - volume / 100)
        let total = (1 - residual) * 100
        let naive = base + promo + volume

        return task(
            r,
            scenario: """
            Дистрибьютор собрал в одну сделку три скидки: базовую дилерскую \(Fmt.pct(base, digits: 0)), \
            промо-акцию \(Fmt.pct(promo, digits: 0)) и бонус за объём \(Fmt.pct(volume, digits: 0)). \
            В договоре они применяются последовательно, каждая — к уже сниженной цене.
            Финансист в письме написал «итого \(Fmt.pct(naive, digits: 0))».
            """,
            question: "Какая фактическая суммарная скидка от прайса получается?",
            answer: total,
            unit: .percent,
            tolerance: .absolute(0.6),
            explanation: """
            Последовательные скидки не складываются: вторая берётся уже с уменьшенной базы. \
            Фактическая скидка всегда меньше суммы процентов — и это ваш запас в переговорах.
            """,
            mentalTrick: "Перемножайте остатки, а не складывайте скидки: \(Fmt.number((100 - base) / 100, digits: 2)) × \(Fmt.number((100 - promo) / 100, digits: 2)) × \(Fmt.number((100 - volume) / 100, digits: 2)).",
            workings: [
                "Остаток от прайса = \(Fmt.number(residual, digits: 3))",
                "Скидка = 1 − \(Fmt.number(residual, digits: 3)) = \(Fmt.pct(total))",
                "Наивная сумма \(Fmt.pct(naive, digits: 0)) завышена на \(Fmt.number(naive - total)) п.п."
            ]
        )
    }
}
