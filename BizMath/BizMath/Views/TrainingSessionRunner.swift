import SwiftUI

/// Отрисовка одной сессии: две ступени на каждой карточке —
/// сначала «какой инструмент», только потом «сколько получится».
///
/// Используется и на вкладке «Тренировка», и в прогоне отдельного модуля.
struct TrainingSessionRunner: View {
    @Bindable var session: TrainingSession
    @FocusState private var answerFocused: Bool

    var body: some View {
        Group {
            switch session.phase {
            case .idle:
                EmptyStateView(
                    symbol: "checkmark.seal",
                    title: "Повторять нечего",
                    message: "FSRS вернёт карточки, когда они начнут забываться. Новые появятся завтра — дневной лимит держит нагрузку ровной.",
                    actionTitle: "Проверить ещё раз",
                    action: { session.start() }
                )

            case .finished:
                summary

            case .classify, .compute, .feedback:
                ScrollView {
                    VStack(spacing: 16) {
                        header
                        if let task = session.currentTask {
                            ScenarioCard(scenario: task.scenario, question: task.question)
                            switch session.phase {
                            case .classify: classifyStep(task)
                            case .compute: computeStep(task)
                            case .feedback: feedbackStep(task)
                            default: EmptyView()
                            }
                        }
                    }
                    .padding(16)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Шапка

    private var header: some View {
        VStack(spacing: 8) {
            HStack {
                Text("\(min(session.position + 1, max(session.queue.count, 1))) из \(session.queue.count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                if let card = session.currentCard {
                    Text(ModuleCatalog.title(id: card.moduleID))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            SwiftUI.ProgressView(value: session.progressFraction)

            if session.phase == .compute {
                timerRow
            }
        }
    }

    private var timerRow: some View {
        HStack(spacing: 8) {
            Image(systemName: session.timeLimit == nil ? "infinity" : "timer")
                .foregroundStyle(session.isOvertime ? .red : .secondary)
            if let limit = session.timeLimit {
                Text("\(Int(session.elapsed)) с из \(Int(limit))")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(session.isOvertime ? .red : .primary)
                Spacer()
                if session.isOvertime {
                    Text("сверх лимита").font(.caption).foregroundStyle(.red)
                }
            } else {
                Text("\(Int(session.elapsed)) с · без лимита")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                Text("режим разогрева").font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Шаг 1: распознавание

    private func classifyStep(_ task: GeneratedTask) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Шаг 1 — что применяем?", systemImage: "1.circle.fill")
                .font(.subheadline.weight(.semibold))
            Text("Выберите инструмент до расчёта. Вернуться и передумать будет нельзя — иначе шаг ничего не измеряет.")
                .font(.caption)
                .foregroundStyle(.secondary)

            ForEach(task.options) { tool in
                ToolOptionButton(tool: tool, appearance: .idle) {
                    session.selectTool(tool)
                    answerFocused = true
                }
            }
        }
    }

    // MARK: - Шаг 2: расчёт

    private func computeStep(_ task: GeneratedTask) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Шаг 2 — посчитайте", systemImage: "2.circle.fill")
                .font(.subheadline.weight(.semibold))

            if let chosen = session.chosenTool {
                // Верность выбора намеренно скрыта до конца расчёта.
                Text("Вы выбрали: \(chosen.title)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack {
                TextField("Ответ", text: $session.answerText)
                    .keyboardType(.decimalPad)
                    .font(.title3.monospacedDigit())
                    .focused($answerFocused)
                Text(task.unit.suffix)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

            Text(task.tolerance.description(expected: task.answer, unit: task.unit)
                 + (task.baseSeconds <= 50 ? " · считайте в уме" : " · можно на бумаге"))
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Button {
                    answerFocused = false
                    session.submitAnswer()
                } label: {
                    Text("Проверить").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(Fmt.parseAnswer(session.answerText) == nil)

                Button("Не знаю") {
                    answerFocused = false
                    session.giveUp()
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Разбор

    private func feedbackStep(_ task: GeneratedTask) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            if let outcome = session.outcome {
                OutcomeBadge(
                    title: "Инструмент",
                    isCorrect: outcome.toolCorrect,
                    detail: outcome.toolCorrect
                        ? task.correctTool.title
                        : "Верно было: \(task.correctTool.title)"
                )
                OutcomeBadge(
                    title: "Расчёт",
                    isCorrect: outcome.answerCorrect,
                    detail: answerDetail(outcome: outcome, task: task)
                )
                if let limit = session.timeLimit, !outcome.withinTimeLimit {
                    Text("Не уложились в лимит \(Int(limit)) с — попытка засчитана, лимит на следующий раз ослабнет.")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Почему так").font(.subheadline.weight(.semibold))
                Text(task.explanation)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
                Label(task.mentalTrick, systemImage: "brain.head.profile")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

            DisclosureGroup("Как считается") {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(task.workings.enumerated()), id: \.offset) { _, line in
                        Text("• " + line)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.top, 6)
            }
            .font(.subheadline.weight(.semibold))
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

            ratingRow
        }
    }

    private func answerDetail(outcome: TrainingSession.Outcome, task: GeneratedTask) -> String {
        let expected = "Ответ: \(task.formattedAnswer)"
        if let given = outcome.answerGiven, !outcome.answerCorrect {
            return expected + " · вы ввели \(Fmt.answer(given, unit: task.unit))"
        }
        return expected
    }

    private var ratingRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Насколько уверенно шло? От этого зависит следующий показ.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                ForEach(FSRSRating.allCases) { rating in
                    let suggested = session.outcome?.suggestedRating == rating
                    Button {
                        session.commit(rating: rating)
                    } label: {
                        VStack(spacing: 3) {
                            Text(rating.title).font(.caption.weight(.semibold))
                            if let interval = session.outcome?.nextIntervals[rating] {
                                Text(Fmt.duration(interval))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                    .tint(suggested ? Color.accentColor : Color.secondary)
                }
            }
        }
    }

    // MARK: - Итог

    private var summary: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Сессия закрыта").font(.title2.weight(.semibold))

                HStack(spacing: 12) {
                    StatTile(
                        title: "Карточек",
                        value: "\(session.stats.answered)",
                        caption: "без единой ошибки: \(session.stats.clean)"
                    )
                    StatTile(
                        title: "Время",
                        value: Fmt.duration(session.stats.totalSeconds),
                        caption: session.stats.answered == 0
                            ? nil
                            : "≈ \(Int(session.stats.totalSeconds / Double(session.stats.answered))) с на карточку"
                    )
                }

                VStack(spacing: 14) {
                    AxisBar(
                        title: "Распознавание инструмента",
                        subtitle: "Верный подход выбран до расчёта",
                        value: session.stats.recognitionAccuracy,
                        display: Fmt.pct(session.stats.recognitionAccuracy * 100, digits: 0),
                        tint: .blue
                    )
                    AxisBar(
                        title: "Точность счёта",
                        subtitle: "Попадание в допуск по числу",
                        value: session.stats.computeAccuracy,
                        display: Fmt.pct(session.stats.computeAccuracy * 100, digits: 0),
                        tint: .green
                    )
                }
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

                Button {
                    session.start()
                } label: {
                    Text("Ещё сессия").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(16)
        }
    }
}
