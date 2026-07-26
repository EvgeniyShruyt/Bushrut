import Foundation

/// Каталог прикладных инструментов. Первый шаг любой карточки — выбрать инструмент
/// **до** расчёта: это и есть тренировка распознавания ситуации.
///
/// Дистракторы берутся из этого же каталога, поэтому все варианты — настоящие
/// рабочие инструменты, просто неподходящие к конкретному кейсу.
enum ToolKind: String, Codable, CaseIterable, Identifiable {
    // Модуль 1 — маржа, наценка, скидки
    case markupToMargin
    case marginToMarkup
    case discountMarginErosion
    case volumeCompensation
    case maxDiscountAtTargetMargin
    case breakEvenUnits
    case breakEvenRevenue
    case contributionMargin
    case cascadedDiscounts

    // Модуль 2 — проценты и дельты
    case percentOfPercent
    case chainedPercentChanges
    case compoundGrowth
    case baseEffect
    case weightedAverage
    case percentagePoints

    // Модуль 3 — деньги во времени
    case discounting
    case paybackSimple
    case paybackDiscounted
    case workingCapital
    case cashConversionCycle

    // Модуль 4 — прогноз и воронка
    case weightedPipeline
    case funnelChain
    case scenarioSensitivity

    // Модуль 5 — математика решений
    case expectedValueComparison
    case roi
    case romi
    case costOfDelay

    // Модуль 6 — P&L и KPI
    case grossMargin
    case ebitdaMargin
    case kpiWeighting

    var id: String { rawValue }

    var title: String {
        switch self {
        case .markupToMargin: return "Наценка → маржа"
        case .marginToMarkup: return "Маржа → наценка"
        case .discountMarginErosion: return "Скидка → падение маржи"
        case .volumeCompensation: return "Компенсация скидки объёмом"
        case .maxDiscountAtTargetMargin: return "Предельная скидка под целевую маржу"
        case .breakEvenUnits: return "Безубыточность в штуках"
        case .breakEvenRevenue: return "Безубыточность в выручке"
        case .contributionMargin: return "Маржинальный вклад"
        case .cascadedDiscounts: return "Каскад скидок"
        case .percentOfPercent: return "Процент от процента"
        case .chainedPercentChanges: return "Цепочка изменений в %"
        case .compoundGrowth: return "Накопленный рост / CAGR"
        case .baseEffect: return "Эффект базы"
        case .weightedAverage: return "Средневзвешенное"
        case .percentagePoints: return "П.п. против процентов"
        case .discounting: return "Дисконтирование"
        case .paybackSimple: return "Простая окупаемость"
        case .paybackDiscounted: return "Дисконтированная окупаемость"
        case .workingCapital: return "Оборотный капитал"
        case .cashConversionCycle: return "Cash conversion cycle"
        case .weightedPipeline: return "Взвешенный прогноз пайплайна"
        case .funnelChain: return "Цепочка конверсий воронки"
        case .scenarioSensitivity: return "Сценарный анализ"
        case .expectedValueComparison: return "Сравнение по expected value"
        case .roi: return "ROI"
        case .romi: return "ROMI"
        case .costOfDelay: return "Стоимость отсрочки"
        case .grossMargin: return "Валовая маржа"
        case .ebitdaMargin: return "Маржа по EBITDA"
        case .kpiWeighting: return "Веса в KPI"
        }
    }

    /// Одна строка: когда именно этот инструмент — правильный.
    var hint: String {
        switch self {
        case .markupToMargin: return "Знаем накрутку на закуп, нужен % от выручки"
        case .marginToMarkup: return "Знаем целевую маржу, нужна накрутка на закуп"
        case .discountMarginErosion: return "Дали скидку — что стало с маржой"
        case .volumeCompensation: return "Сколько объёма нужно, чтобы скидка окупилась"
        case .maxDiscountAtTargetMargin: return "Докуда можно падать в цене"
        case .breakEvenUnits: return "Сколько штук закрывает постоянные затраты"
        case .breakEvenRevenue: return "Какая выручка закрывает постоянные затраты"
        case .contributionMargin: return "Сколько приносит одна проданная единица"
        case .cascadedDiscounts: return "Несколько скидок подряд от разных баз"
        case .percentOfPercent: return "Доля внутри доли"
        case .chainedPercentChanges: return "Последовательные изменения одной величины"
        case .compoundGrowth: return "Рост за несколько периодов, среднегодовой темп"
        case .baseEffect: return "Сравнение с аномальной базой прошлого периода"
        case .weightedAverage: return "Среднее по разным объёмам"
        case .percentagePoints: return "Разница п.п. против относительного роста"
        case .discounting: return "Деньги в будущем в сегодняшних деньгах"
        case .paybackSimple: return "За сколько вернутся вложения без ставки"
        case .paybackDiscounted: return "Окупаемость с учётом стоимости денег"
        case .workingCapital: return "Сколько денег заморожено в обороте"
        case .cashConversionCycle: return "Сколько дней деньги не у нас"
        case .weightedPipeline: return "Прогноз с учётом вероятностей сделок"
        case .funnelChain: return "Перемножение конверсий по этапам"
        case .scenarioSensitivity: return "Что будет, если параметр сдвинется"
        case .expectedValueComparison: return "Выбор варианта с лучшим ожидаемым исходом"
        case .roi: return "Отдача на вложенное"
        case .romi: return "Отдача на маркетинговый бюджет"
        case .costOfDelay: return "Цена месяца промедления"
        case .grossMargin: return "Валовая прибыль к выручке"
        case .ebitdaMargin: return "EBITDA к выручке"
        case .kpiWeighting: return "Как вес метрики двигает поведение"
        }
    }

    var moduleID: String {
        switch self {
        case .markupToMargin, .marginToMarkup, .discountMarginErosion, .volumeCompensation,
             .maxDiscountAtTargetMargin, .breakEvenUnits, .breakEvenRevenue,
             .contributionMargin, .cascadedDiscounts:
            return ModuleCatalog.margin
        case .percentOfPercent, .chainedPercentChanges, .compoundGrowth,
             .baseEffect, .weightedAverage, .percentagePoints:
            return ModuleCatalog.percents
        case .discounting, .paybackSimple, .paybackDiscounted, .workingCapital, .cashConversionCycle:
            return ModuleCatalog.timeValue
        case .weightedPipeline, .funnelChain, .scenarioSensitivity:
            return ModuleCatalog.forecast
        case .expectedValueComparison, .roi, .romi, .costOfDelay:
            return ModuleCatalog.decisions
        case .grossMargin, .ebitdaMargin, .kpiWeighting:
            return ModuleCatalog.pnl
        }
    }
}
