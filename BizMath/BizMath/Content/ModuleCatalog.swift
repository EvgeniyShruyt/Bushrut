import Foundation

/// Описание шести модулей программы. Порядок фиксированный: внутри каждого — от простого к сложному.
enum ModuleCatalog {
    static let margin = "m1"
    static let percents = "m2"
    static let timeValue = "m3"
    static let forecast = "m4"
    static let decisions = "m5"
    static let pnl = "m6"

    struct Descriptor {
        let id: String
        let order: Int
        let title: String
        let summary: String
        let symbolName: String
    }

    static let all: [Descriptor] = [
        Descriptor(
            id: margin,
            order: 1,
            title: "Маржа, наценка, скидки",
            summary: "Перевод наценки в маржу, цена скидки в прибыли, точка безубыточности",
            symbolName: "percent"
        ),
        Descriptor(
            id: percents,
            order: 2,
            title: "Проценты и дельты в уме",
            summary: "Процент от процента, накопленный рост, эффект базы, средневзвешенное",
            symbolName: "function"
        ),
        Descriptor(
            id: timeValue,
            order: 3,
            title: "Деньги во времени",
            summary: "Дисконтирование, окупаемость, оборотный капитал и cash conversion cycle",
            symbolName: "clock.arrow.circlepath"
        ),
        Descriptor(
            id: forecast,
            order: 4,
            title: "Прогноз и воронка",
            summary: "Взвешенный пайплайн, цепочка конверсий, сценарный анализ",
            symbolName: "chart.line.uptrend.xyaxis"
        ),
        Descriptor(
            id: decisions,
            order: 5,
            title: "Математика решений",
            summary: "Expected value, ROI и ROMI, стоимость отсрочки решения",
            symbolName: "arrow.triangle.branch"
        ),
        Descriptor(
            id: pnl,
            order: 6,
            title: "Чтение P&L и KPI",
            summary: "Валовая маржа и EBITDA за 10 секунд, логика весов в бонусной схеме",
            symbolName: "tablecells"
        )
    ]

    static func descriptor(id: String) -> Descriptor? {
        all.first { $0.id == id }
    }

    static func title(id: String) -> String {
        descriptor(id: id)?.title ?? id
    }
}
