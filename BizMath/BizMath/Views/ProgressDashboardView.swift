import SwiftUI
import SwiftData
import Charts

/// Прогресс по двум осям. Это принципиально разные навыки, поэтому они нигде не смешиваются
/// в одну «общую успеваемость».
struct ProgressDashboardView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Attempt.date, order: .reverse) private var attempts: [Attempt]

    @State private var window: Window = .twoWeeks
    @State private var showSettings = false

    enum Window: String, CaseIterable, Identifiable {
        case week = "7 дней"
        case twoWeeks = "14 дней"
        case allTime = "Всё время"
        var id: String { rawValue }

        var days: Int? {
            switch self {
            case .week: return 7
            case .twoWeeks: return 14
            case .allTime: return nil
            }
        }
    }

    private var windowedAttempts: [Attempt] {
        guard let days = window.days,
              let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date())
        else { return attempts }
        return attempts.filter { $0.date >= cutoff }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Picker("Период", selection: $window) {
                        ForEach(Window.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    if attempts.isEmpty {
                        EmptyStateView(
                            symbol: "chart.bar.doc.horizontal",
                            title: "Данных пока нет",
                            message: "Пройдите первую сессию — обе оси начнут заполняться отдельно друг от друга."
                        )
                    } else {
                        axesSection
                        accuracyChart
                        speedChart
                        loadForecast
                        modulesSection
                        confusionsSection
                    }
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Прогресс")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
    }

    // MARK: - Две оси

    private var axesSection: some View {
        let summary = StatsService.summary(windowedAttempts)
        let streak = StatsService.streak(attempts)

        return VStack(spacing: 14) {
            HStack(spacing: 12) {
                StatTile(
                    title: "Попыток",
                    value: "\(summary.attempts)",
                    caption: "чисто: \(Fmt.pct(summary.cleanShare * 100, digits: 0))"
                )
                StatTile(
                    title: "Серия",
                    value: "\(streak)",
                    caption: streak == 1 ? "день подряд" : "дней подряд",
                    tint: .purple
                )
            }

            VStack(spacing: 16) {
                AxisBar(
                    title: "Ось 1 · Распознавание",
                    subtitle: "Верный инструмент выбран до расчёта",
                    value: summary.recognitionAccuracy,
                    display: Fmt.pct(summary.recognitionAccuracy * 100, digits: 0),
                    tint: .blue
                )
                AxisBar(
                    title: "Ось 2 · Скорость счёта",
                    subtitle: speedSubtitle(summary),
                    value: speedValue(summary),
                    display: summary.medianSeconds.map { "\(Int($0)) с" } ?? "—",
                    tint: .orange
                )
                AxisBar(
                    title: "Точность счёта",
                    subtitle: "Попадание в допуск по числу",
                    value: summary.computeAccuracy,
                    display: Fmt.pct(summary.computeAccuracy * 100, digits: 0),
                    tint: .green
                )
            }
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private func speedSubtitle(_ summary: StatsService.AxisSummary) -> String {
        guard let share = summary.withinLimitShare else {
            return "Медиана времени на верный расчёт · лимит ещё не включён"
        }
        return "Медиана времени · в лимит уложились \(Fmt.pct(share * 100, digits: 0))"
    }

    /// Нормируем скорость к шкале 0…1: 90 секунд и хуже → 0, 10 секунд → 1.
    private func speedValue(_ summary: StatsService.AxisSummary) -> Double {
        guard let median = summary.medianSeconds else { return 0 }
        return min(max((90 - median) / 80, 0), 1)
    }

    // MARK: - Графики

    private var accuracyChart: some View {
        let points = StatsService.daily(windowedAttempts, days: window.days ?? 30)
            .filter { $0.attempts > 0 }

        return VStack(alignment: .leading, spacing: 8) {
            Text("Точность по дням")
                .font(.subheadline.weight(.semibold))
            Text("Синяя — выбор инструмента, зелёная — расчёт. Расхождение линий показывает, какой навык отстаёт.")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Chart {
                ForEach(points) { point in
                    LineMark(
                        x: .value("День", point.date, unit: .day),
                        y: .value("Точность", point.recognitionAccuracy),
                        series: .value("Ось", "Распознавание")
                    )
                    .foregroundStyle(.blue)
                    .symbol(.circle)

                    LineMark(
                        x: .value("День", point.date, unit: .day),
                        y: .value("Точность", point.computeAccuracy),
                        series: .value("Ось", "Счёт")
                    )
                    .foregroundStyle(.green)
                    .symbol(.square)
                }
            }
            .chartYScale(domain: 0...1)
            .chartYAxis {
                AxisMarks(values: [0, 0.25, 0.5, 0.75, 1]) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let doubleValue = value.as(Double.self) {
                            Text(Fmt.pct(doubleValue * 100, digits: 0))
                        }
                    }
                }
            }
            .frame(height: 180)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private var speedChart: some View {
        let points = StatsService.daily(windowedAttempts, days: window.days ?? 30)
            .filter { $0.medianSeconds != nil }

        return VStack(alignment: .leading, spacing: 8) {
            Text("Скорость счёта по дням")
                .font(.subheadline.weight(.semibold))
            Text("Медиана времени на верный расчёт. Тренд вниз — счёт уходит в автоматизм.")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Chart {
                ForEach(points) { point in
                    BarMark(
                        x: .value("День", point.date, unit: .day),
                        y: .value("Секунды", point.medianSeconds ?? 0)
                    )
                    .foregroundStyle(.orange.gradient)
                }
            }
            .frame(height: 150)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private var loadForecast: some View {
        let forecast = ReviewScheduler.forecast(context: modelContext, days: 14)

        return VStack(alignment: .leading, spacing: 8) {
            Text("Что вернётся на повторение")
                .font(.subheadline.weight(.semibold))
            Text("План FSRS на две недели вперёд — интервалы считает алгоритм, не расписание.")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Chart {
                ForEach(Array(forecast.enumerated()), id: \.offset) { _, item in
                    BarMark(
                        x: .value("День", item.date, unit: .day),
                        y: .value("Карточек", item.count)
                    )
                    .foregroundStyle(Color.accentColor)
                }
            }
            .frame(height: 120)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Разрезы

    private var modulesSection: some View {
        let summaries = StatsService.modules(context: modelContext, attempts: windowedAttempts)

        return VStack(alignment: .leading, spacing: 10) {
            Text("По модулям")
                .font(.subheadline.weight(.semibold))

            ForEach(summaries) { summary in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(summary.title)
                            .font(.subheadline)
                        Spacer()
                        Text("\(summary.cardsStarted)/\(summary.cardsTotal) карточек")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if summary.attempts == 0 {
                        Text(summary.cardsTotal == 0 ? "Заготовка — контент в разработке" : "Ещё не начинали")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    } else {
                        HStack(spacing: 16) {
                            metric("инструмент", Fmt.pct(summary.recognitionAccuracy * 100, digits: 0), .blue)
                            metric("счёт", Fmt.pct(summary.computeAccuracy * 100, digits: 0), .green)
                            if let median = summary.medianSeconds {
                                metric("медиана", "\(Int(median)) с", .orange)
                            }
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func metric(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.footnote.weight(.semibold)).foregroundStyle(tint)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var confusionsSection: some View {
        let confusions = StatsService.confusions(windowedAttempts)
        if !confusions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Что с чем путается")
                    .font(.subheadline.weight(.semibold))
                Text("Самые частые подмены инструмента — это и есть слабое место в распознавании.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                ForEach(confusions) { confusion in
                    HStack(alignment: .top, spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(confusion.expected.title)
                                .font(.footnote.weight(.semibold))
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.turn.down.right")
                                    .font(.caption2)
                                    .foregroundStyle(.red)
                                Text("выбрано: \(confusion.chosen.title)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Text("×\(confusion.count)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}
