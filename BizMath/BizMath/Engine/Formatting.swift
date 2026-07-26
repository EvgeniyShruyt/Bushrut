import Foundation

/// Форматирование чисел «как в отчёте»: неразрывные пробелы в разрядах, запятая как разделитель.
enum Fmt {
    static let locale = Locale(identifier: "ru_RU")

    private static let decimal: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.decimalSeparator = ","
        f.maximumFractionDigits = 1
        f.minimumFractionDigits = 0
        return f
    }()

    private static let money: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.decimalSeparator = ","
        f.maximumFractionDigits = 0
        return f
    }()

    static func number(_ value: Double, digits: Int = 1) -> String {
        decimal.maximumFractionDigits = digits
        return decimal.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func rub(_ value: Double) -> String {
        (money.string(from: NSNumber(value: value)) ?? String(Int(value))) + "\u{00A0}₽"
    }

    /// Крупные суммы — в млн, чтобы сценарий читался как реальный отчёт.
    static func mln(_ value: Double, digits: Int = 1) -> String {
        number(value / 1_000_000, digits: digits) + "\u{00A0}млн\u{00A0}₽"
    }

    /// Сама выбирает разрядность: млрд / млн / рубли.
    static func big(_ value: Double) -> String {
        if abs(value) >= 1_000_000_000 {
            return number(value / 1_000_000_000, digits: 1) + "\u{00A0}млрд\u{00A0}₽"
        }
        if abs(value) >= 1_000_000 {
            return mln(value)
        }
        return rub(value)
    }

    static func pct(_ value: Double, digits: Int = 1) -> String {
        number(value, digits: digits) + "\u{00A0}%"
    }

    static func units(_ value: Double) -> String {
        (money.string(from: NSNumber(value: value)) ?? String(Int(value))) + "\u{00A0}шт"
    }

    static func answer(_ value: Double, unit: AnswerUnit) -> String {
        switch unit {
        case .percent: return pct(value)
        case .percentagePoints: return number(value) + "\u{00A0}п.п."
        case .rubles: return rub(value)
        case .units: return units(value)
        case .months: return number(value) + "\u{00A0}мес"
        case .days: return number(value, digits: 0) + "\u{00A0}дн"
        case .times: return number(value, digits: 2) + "×"
        }
    }

    /// Парсит пользовательский ввод: принимает и запятую, и точку, игнорирует пробелы и знак %.
    static func parseAnswer(_ raw: String) -> Double? {
        let cleaned = raw
            .replacingOccurrences(of: "\u{00A0}", with: "")
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
            .replacingOccurrences(of: "%", with: "")
            .replacingOccurrences(of: "₽", with: "")
        guard !cleaned.isEmpty else { return nil }
        return Double(cleaned)
    }

    static func duration(_ seconds: TimeInterval) -> String {
        if seconds < 60 { return "\(Int(seconds.rounded())) с" }
        if seconds < 3600 { return "\(Int((seconds / 60).rounded())) мин" }
        if seconds < 86_400 { return "\(Int((seconds / 3600).rounded())) ч" }
        let days = seconds / 86_400
        if days < 31 { return "\(Int(days.rounded())) дн" }
        if days < 365 { return "\(number(days / 30.44)) мес" }
        return "\(number(days / 365.25)) г"
    }
}
