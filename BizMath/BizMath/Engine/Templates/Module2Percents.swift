import Foundation

/// Модуль 2 — «Проценты и дельты в уме». Стартовый набор карточек.
enum Module2Percents {

    static let templates: [TaskTemplate] = [
        PercentOfPercent(),
        PercentagePointsVsPercent(),
        ChainedPercentChanges(),
        RecoveryAfterDrop(),
        CompoundGrowthCAGR(),
        BaseEffect(),
        WeightedPortfolioDiscount(),
        WeightedPortfolioMargin()
    ]

    static let pool: [ToolKind] = [
        .percentOfPercent, .chainedPercentChanges, .compoundGrowth, .baseEffect,
        .weightedAverage, .percentagePoints, .cascadedDiscounts,
        .markupToMargin, .scenarioSensitivity, .grossMargin
    ]
}

// MARK: - 2.1 Процент от процента

private struct PercentOfPercent: TaskTemplate {
    let id = "m2.percent_of_percent"
    let moduleID = ModuleCatalog.percents
    let title = "Процент от процента"
    let difficulty = 1
    let correctTool: ToolKind = .percentOfPercent
    let distractors = Module2Percents.pool
    let baseSeconds: Double = 35

    func generate(_ r: Randomizer) -> GeneratedTask {
        let segmentShare = r.percent(14...34, step: 1)
        let ourShare = r.percent(9...28, step: 1)
        let marketSize = r.money(18...64, step: 1) * 1_000_000_000
        let result = segmentShare * ourShare / 100
        let ourRevenue = marketSize * result / 100

        return task(
            r,
            scenario: """
            Маркетинг принёс слайд к стратсессии: рынок целиком — \(Fmt.number(marketSize / 1_000_000_000)) млрд ₽. \
            Наш сегмент внутри него — \(Fmt.pct(segmentShare, digits: 0)) рынка, и мы держим \
            \(Fmt.pct(ourShare, digits: 0)) этого сегмента.
            Инвестор на встрече спросит долю рынка одной цифрой.
            """,
            question: "Какую долю всего рынка мы занимаем?",
            answer: result,
            unit: .percent,
            tolerance: .absolute(0.4),
            explanation: """
            Доля внутри доли — это произведение, а не сумма и не разность. \
            Проценты живут на разных базах: второй считается уже от куска, а не от целого.
            """,
            mentalTrick: "\(Fmt.number(segmentShare, digits: 0)) % от \(Fmt.number(ourShare, digits: 0)) % → \(Fmt.number(segmentShare, digits: 0)) × \(Fmt.number(ourShare, digits: 0)) / 100.",
            workings: [
                "\(Fmt.number(segmentShare, digits: 0)) × \(Fmt.number(ourShare, digits: 0)) = \(Fmt.number(segmentShare * ourShare, digits: 0))",
                "Делим на 100 → \(Fmt.pct(result))",
                "В деньгах это ≈ \(Fmt.big(ourRevenue)) рынка"
            ]
        )
    }
}

// MARK: - 2.2 П.п. против процентов

private struct PercentagePointsVsPercent: TaskTemplate {
    let id = "m2.percentage_points"
    let moduleID = ModuleCatalog.percents
    let title = "П.п. против процентов"
    let difficulty = 2
    let correctTool: ToolKind = .percentagePoints
    let distractors = Module2Percents.pool
    let baseSeconds: Double = 40

    func generate(_ r: Randomizer) -> GeneratedTask {
        let from = r.percent(7...21, step: 1)
        let delta = r.percent(2...6, step: 1)
        let to = from + delta
        let relative = delta / from * 100

        return task(
            r,
            scenario: """
            Руководитель продаж отчитывается за квартал: конверсия из демо в сделку выросла \
            с \(Fmt.pct(from, digits: 0)) до \(Fmt.pct(to, digits: 0)). \
            В презентации совету он написал «рост конверсии на \(Fmt.number(delta, digits: 0)) %».
            Вы решаете, ставить ли это в KPI как достижение квартала.
            """,
            question: "На сколько процентов реально выросла конверсия?",
            answer: relative,
            unit: .percent,
            tolerance: .absolute(1.2),
            explanation: """
            Разница между процентами измеряется в пунктах, а рост — в процентах от старого значения. \
            Это два разных числа, и подмена одного другим — самый частый способ приукрасить отчёт.
            """,
            mentalTrick: "Рост = \(Fmt.number(delta, digits: 0)) п.п. / \(Fmt.number(from, digits: 0)) базы. Делим дельту на старое значение, не на 100.",
            workings: [
                "Абсолютный сдвиг: +\(Fmt.number(delta, digits: 0)) п.п.",
                "Относительный рост: \(Fmt.number(delta, digits: 0)) / \(Fmt.number(from, digits: 0)) = \(Fmt.pct(relative))",
                "В отчёте корректно: «+\(Fmt.number(delta, digits: 0)) п.п., то есть \(Fmt.pct(relative)) к базе»"
            ]
        )
    }
}

// MARK: - 2.3 Цепочка изменений

private struct ChainedPercentChanges: TaskTemplate {
    let id = "m2.chained_changes"
    let moduleID = ModuleCatalog.percents
    let title = "Цепочка изменений"
    let difficulty = 2
    let correctTool: ToolKind = .chainedPercentChanges
    let distractors = Module2Percents.pool
    let baseSeconds: Double = 45

    func generate(_ r: Randomizer) -> GeneratedTask {
        let up = r.percent(6...19, step: 1)
        let down = r.percent(4...14, step: 1)
        let factor = (1 + up / 100) * (1 - down / 100)
        let net = (factor - 1) * 100
        let naive = up - down

        return task(
            r,
            scenario: """
            В январе вы подняли прайс на \(Fmt.pct(up, digits: 0)) вслед за курсом. \
            В июне под давлением конкурента дали общее снижение \(Fmt.pct(down, digits: 0)) от нового прайса.
            Финдир спрашивает, где цена относительно декабря — на планировании выручки это ключевая цифра.
            """,
            question: "На сколько процентов цена отличается от декабрьской? (ответ по модулю, без знака)",
            answer: abs(net),
            unit: .percent,
            tolerance: .absolute(0.5),
            explanation: """
            Проценты в цепочке перемножаются, а не складываются: второе изменение берётся \
            от уже изменённой базы. Поэтому «+\(Fmt.number(up, digits: 0)) и −\(Fmt.number(down, digits: 0))» \
            никогда не равно \(Fmt.number(naive, digits: 0)).
            """,
            mentalTrick: "Перемножьте коэффициенты: \(Fmt.number(1 + up / 100, digits: 2)) × \(Fmt.number(1 - down / 100, digits: 2)).",
            workings: [
                "\(Fmt.number(1 + up / 100, digits: 2)) × \(Fmt.number(1 - down / 100, digits: 2)) = \(Fmt.number(factor, digits: 3))",
                "Цена \(net >= 0 ? "выше" : "ниже") декабрьской на \(Fmt.pct(abs(net)))",
                "Наивный ответ \(Fmt.number(naive, digits: 0)) % ошибается на \(Fmt.number(abs(naive - net), digits: 2)) п.п."
            ]
        )
    }
}

// MARK: - 2.4 Возврат к базе после падения

private struct RecoveryAfterDrop: TaskTemplate {
    let id = "m2.recovery_after_drop"
    let moduleID = ModuleCatalog.percents
    let title = "Возврат после падения"
    let difficulty = 3
    let correctTool: ToolKind = .chainedPercentChanges
    let distractors = Module2Percents.pool
    let baseSeconds: Double = 45

    func generate(_ r: Randomizer) -> GeneratedTask {
        let drop = r.percent(9...31, step: 1)
        let needed = (1 / (1 - drop / 100) - 1) * 100

        return task(
            r,
            scenario: """
            В борьбе за долю рынка средняя цена реализации просела на \(Fmt.pct(drop, digits: 0)) \
            относительно прошлого года. Объёмы удержали, но валовая прибыль ушла в минус к плану.
            На стратегической сессии обсуждают возврат цены к прошлогоднему уровню.
            """,
            question: "На сколько процентов нужно поднять текущую цену, чтобы вернуться к прежнему уровню?",
            answer: needed,
            unit: .percent,
            tolerance: .absolute(0.8),
            explanation: """
            Падение и возврат считаются от разных баз: упали от старой цены, а поднимать нужно \
            от новой, более низкой. Поэтому обратный ход всегда больше по проценту, чем само падение.
            """,
            mentalTrick: "Рост = 1 / (1 − падение) − 1. Осталось \(Fmt.number((100 - drop) / 100, digits: 2)) → делим 1 на это.",
            workings: [
                "После падения осталось \(Fmt.number(100 - drop, digits: 0)) % цены",
                "1 / \(Fmt.number((100 - drop) / 100, digits: 2)) = \(Fmt.number(1 / (1 - drop / 100), digits: 3))",
                "Нужен рост \(Fmt.pct(needed)) — против падения \(Fmt.pct(drop, digits: 0))"
            ]
        )
    }
}

// MARK: - 2.5 Накопленный рост и CAGR

private struct CompoundGrowthCAGR: TaskTemplate {
    let id = "m2.compound_growth"
    let moduleID = ModuleCatalog.percents
    let title = "Накопленный рост vs среднее"
    let difficulty = 3
    let correctTool: ToolKind = .compoundGrowth
    let distractors = Module2Percents.pool
    let isMentalMath = false
    let baseSeconds: Double = 75

    func generate(_ r: Randomizer) -> GeneratedTask {
        let g1 = r.percent(11...29, step: 1)
        let g2 = r.percent(3...16, step: 1)
        let g3 = r.percent(-9...8, step: 1)
        let factor = (1 + g1 / 100) * (1 + g2 / 100) * (1 + g3 / 100)
        let cagr = (pow(factor, 1.0 / 3.0) - 1) * 100
        let simpleAverage = (g1 + g2 + g3) / 3
        let cumulative = (factor - 1) * 100

        return task(
            r,
            scenario: """
            Готовите трёхлетний трек для инвестора. Годовые темпы выручки: \
            \(signed(g1)), затем \(signed(g2)), затем \(signed(g3)).
            Инвестор просит одну цифру — среднегодовой темп роста, и он будет сверять её \
            с накопленным итогом за три года.
            """,
            question: "Какой среднегодовой темп роста (CAGR) получается?",
            answer: cagr,
            unit: .percent,
            tolerance: .absolute(0.6),
            explanation: """
            Простое среднее темпов завышает результат: рост капитализируется, а не складывается. \
            CAGR — это тот единственный ровный темп, который из старта даёт фактический финиш.
            """,
            mentalTrick: "Сначала накопленный итог: \(Fmt.number(factor, digits: 3))× за 3 года. CAGR — корень третьей степени из него.",
            workings: [
                "Накопленный коэффициент = \(Fmt.number(factor, digits: 3)) → рост \(Fmt.pct(cumulative)) за 3 года",
                "CAGR = \(Fmt.number(factor, digits: 3))^(1/3) − 1 = \(Fmt.pct(cagr))",
                "Простое среднее дало бы \(Fmt.pct(simpleAverage)) — завышение на \(Fmt.number(simpleAverage - cagr)) п.п."
            ]
        )
    }

    private func signed(_ value: Double) -> String {
        (value >= 0 ? "+" : "−") + Fmt.pct(abs(value), digits: 0)
    }
}

// MARK: - 2.6 Эффект базы

private struct BaseEffect: TaskTemplate {
    let id = "m2.base_effect"
    let moduleID = ModuleCatalog.percents
    let title = "Эффект базы"
    let difficulty = 4
    let correctTool: ToolKind = .baseEffect
    let distractors = Module2Percents.pool
    let baseSeconds: Double = 60

    func generate(_ r: Randomizer) -> GeneratedTask {
        let normal = r.money(58...92, step: 1) * 1_000_000
        let collapse = r.percent(31...46, step: 1)
        let lastYear = (normal * (1 - collapse / 100) / 100_000).rounded() * 100_000
        let recoveryGap = r.percent(6...19, step: 1)
        let current = (normal * (1 - recoveryGap / 100) / 100_000).rounded() * 100_000
        let yoy = (current / lastYear - 1) * 100
        let gap = (1 - current / normal) * 100

        return task(
            r,
            scenario: """
            Q2 позапрошлого года был нормальным: \(Fmt.mln(normal)). \
            В Q2 прошлого года встал ключевой поставщик, и квартал упал до \(Fmt.mln(lastYear)). \
            Текущий Q2 — \(Fmt.mln(current)), и отдел продаж празднует рост \
            \(Fmt.pct(yoy, digits: 0)) год к году и просит бонусы.
            """,
            question: "На сколько процентов текущий квартал ниже нормального уровня позапрошлого года?",
            answer: gap,
            unit: .percent,
            tolerance: .absolute(0.9),
            explanation: """
            Рост год к году измеряется от провальной базы и потому раздут. Правильный вопрос — \
            где мы относительно нормального уровня. Эффект базы работает и в обратную сторону: \
            после сильного года следующий покажет «падение» без реальной деградации.
            """,
            mentalTrick: "Сравнивайте с нормой, а не с аномалией: \(Fmt.number(current / 1_000_000)) против \(Fmt.number(normal / 1_000_000)) млн.",
            workings: [
                "Рост г/г = \(Fmt.mln(current)) / \(Fmt.mln(lastYear)) − 1 = \(Fmt.pct(yoy)) — от провальной базы",
                "К норме = \(Fmt.mln(current)) / \(Fmt.mln(normal)) = \(Fmt.number(current / normal, digits: 3))",
                "Отставание от нормы = \(Fmt.pct(gap))"
            ]
        )
    }
}

// MARK: - 2.7 Средневзвешенная скидка по портфелю

private struct WeightedPortfolioDiscount: TaskTemplate {
    let id = "m2.weighted_discount"
    let moduleID = ModuleCatalog.percents
    let title = "Средневзвешенная скидка"
    let difficulty = 4
    let correctTool: ToolKind = .weightedAverage
    let distractors = Module2Percents.pool
    let isMentalMath = false
    let baseSeconds: Double = 80

    func generate(_ r: Randomizer) -> GeneratedTask {
        let v1 = r.money(28...64, step: 1) * 1_000_000
        let v2 = r.money(12...28, step: 1) * 1_000_000
        let v3 = r.money(4...12, step: 1) * 1_000_000
        let d1 = r.percent(4...9, step: 1)
        let d2 = r.percent(11...17, step: 1)
        let d3 = r.percent(19...27, step: 1)

        let total = v1 + v2 + v3
        let weighted = (v1 * d1 + v2 * d2 + v3 * d3) / total
        let simple = (d1 + d2 + d3) / 3

        return task(
            r,
            scenario: """
            Разбираете скидочную политику перед пересмотром прайса. Прайсовая выручка по каналам:
            • Прямые продажи — \(Fmt.mln(v1)), средняя скидка \(Fmt.pct(d1, digits: 0))
            • Дилеры — \(Fmt.mln(v2)), скидка \(Fmt.pct(d2, digits: 0))
            • Федеральные сети — \(Fmt.mln(v3)), скидка \(Fmt.pct(d3, digits: 0))
            Собственник спрашивает: «Сколько мы в среднем отдаём скидкой?»
            """,
            question: "Какая средняя скидка по портфелю?",
            answer: weighted,
            unit: .percent,
            tolerance: .absolute(0.5),
            explanation: """
            Среднее по каналам без учёта объёмов врёт: маленький канал с большой скидкой \
            тянет цифру вверх, хотя денег в нём почти нет. Веса — это выручка, а не количество строк.
            """,
            mentalTrick: "Основной вес у прямых (\(Fmt.number(v1 / total * 100, digits: 0)) % выручки) → ответ будет близко к \(Fmt.pct(d1, digits: 0)).",
            workings: [
                "Сумма скидок в деньгах = \(Fmt.mln((v1 * d1 + v2 * d2 + v3 * d3) / 100))",
                "Прайсовая выручка = \(Fmt.mln(total))",
                "Средневзвешенная = \(Fmt.pct(weighted)); простое среднее дало бы \(Fmt.pct(simple))"
            ]
        )
    }
}

// MARK: - 2.8 Средневзвешенная маржа

private struct WeightedPortfolioMargin: TaskTemplate {
    let id = "m2.weighted_margin"
    let moduleID = ModuleCatalog.percents
    let title = "Средневзвешенная маржа"
    let difficulty = 5
    let correctTool: ToolKind = .weightedAverage
    let distractors = Module2Percents.pool
    let isMentalMath = false
    let baseSeconds: Double = 85

    func generate(_ r: Randomizer) -> GeneratedTask {
        let rev1 = r.money(41...78, step: 1) * 1_000_000
        let rev2 = r.money(16...34, step: 1) * 1_000_000
        let rev3 = r.money(6...15, step: 1) * 1_000_000
        let m1 = r.percent(12...19, step: 1)
        let m2 = r.percent(26...36, step: 1)
        let m3 = r.percent(48...62, step: 1)

        let total = rev1 + rev2 + rev3
        let weighted = (rev1 * m1 + rev2 * m2 + rev3 * m3) / total
        let simple = (m1 + m2 + m3) / 3

        return task(
            r,
            scenario: """
            Готовите годовой бюджет. Выручка и валовая маржа по направлениям:
            • Оборудование — \(Fmt.mln(rev1)), маржа \(Fmt.pct(m1, digits: 0))
            • Монтаж — \(Fmt.mln(rev2)), маржа \(Fmt.pct(m2, digits: 0))
            • Сервисные контракты — \(Fmt.mln(rev3)), маржа \(Fmt.pct(m3, digits: 0))
            В модель бюджета нужна одна ставка валовой маржи по компании.
            """,
            question: "Какая валовая маржа по компании в целом?",
            answer: weighted,
            unit: .percent,
            tolerance: .absolute(0.6),
            explanation: """
            Общая маржа компании — это валовая прибыль, делённая на выручку, а не среднее \
            маржинальностей. Высокомаржинальный сервис почти не двигает итог, пока его доля \
            в выручке мала — и именно поэтому «растить сервис» звучит лучше, чем работает в первый год.
            """,
            mentalTrick: "Оборудование даёт \(Fmt.number(rev1 / total * 100, digits: 0)) % выручки — итог будет тяготеть к \(Fmt.pct(m1, digits: 0)).",
            workings: [
                "Валовая прибыль = \(Fmt.mln((rev1 * m1 + rev2 * m2 + rev3 * m3) / 100))",
                "Выручка = \(Fmt.mln(total))",
                "Маржа = \(Fmt.pct(weighted)); среднее по направлениям дало бы \(Fmt.pct(simple)) — на \(Fmt.number(simple - weighted)) п.п. выше"
            ]
        )
    }
}
