import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var settingsList: [AppSettings]

    @State private var showResetConfirmation = false

    private var settings: AppSettings? { settingsList.first }

    var body: some View {
        NavigationStack {
            Form {
                if let settings {
                    Section {
                        Stepper(
                            "Новых карточек в день: \(settings.newCardsPerDay)",
                            value: Binding(
                                get: { settings.newCardsPerDay },
                                set: { settings.newCardsPerDay = $0 }
                            ),
                            in: 1...20
                        )
                        Stepper(
                            "Карточек за сессию: \(settings.sessionSize)",
                            value: Binding(
                                get: { settings.sessionSize },
                                set: { settings.sessionSize = $0 }
                            ),
                            in: 5...40
                        )
                    } header: {
                        Text("Нагрузка")
                    } footer: {
                        Text("Сегодня доступно ещё \(settings.remainingNewToday) новых карточек.")
                    }

                    Section {
                        Toggle("Таймер на счёт", isOn: Binding(
                            get: { settings.timerEnabled },
                            set: { settings.timerEnabled = $0 }
                        ))
                        Stepper(
                            "Разогрев без лимита: \(settings.untimedWarmupAttempts) попыт.",
                            value: Binding(
                                get: { settings.untimedWarmupAttempts },
                                set: { settings.untimedWarmupAttempts = $0 }
                            ),
                            in: 0...10
                        )
                    } header: {
                        Text("Скорость")
                    } footer: {
                        Text("Сначала карточка отрабатывается без ограничения. Лимит включается после разогрева и дальше сокращается сам — по мере роста точности, но не быстрее вашего реального темпа.")
                    }

                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Целевая вероятность вспоминания")
                                Spacer()
                                Text(Fmt.pct(settings.desiredRetention * 100, digits: 0))
                                    .foregroundStyle(.secondary)
                            }
                            Slider(
                                value: Binding(
                                    get: { settings.desiredRetention },
                                    set: { settings.desiredRetention = $0 }
                                ),
                                in: 0.80...0.97,
                                step: 0.01
                            )
                        }
                    } header: {
                        Text("Интервальные повторения")
                    } footer: {
                        Text("Параметр FSRS-5: чем выше, тем короче интервалы и тем больше повторений в день. 90 % — рабочий компромисс.")
                    }

                    Section {
                        Button("Сбросить прогресс", role: .destructive) {
                            showResetConfirmation = true
                        }
                    } footer: {
                        Text("Удалит историю попыток и расписание. Карточки и модули останутся.")
                    }
                }

                Section {
                    LabeledContent("Карточек в программе", value: "\(TemplateRegistry.all.count)")
                    LabeledContent("Заготовок в плане", value: "\(TemplateRegistry.allBacklog.count)")
                    LabeledContent("Работа с сетью", value: "нет")
                } header: {
                    Text("О приложении")
                }
            }
            .navigationTitle("Настройки")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Готово") {
                        try? modelContext.save()
                        dismiss()
                    }
                }
            }
            .confirmationDialog(
                "Сбросить весь прогресс?",
                isPresented: $showResetConfirmation,
                titleVisibility: .visible
            ) {
                Button("Сбросить", role: .destructive) { resetProgress() }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("История попыток и состояние FSRS будут удалены безвозвратно.")
            }
        }
    }

    private func resetProgress() {
        let attempts = (try? modelContext.fetch(FetchDescriptor<Attempt>())) ?? []
        for attempt in attempts { modelContext.delete(attempt) }

        let cards = (try? modelContext.fetch(FetchDescriptor<Card>())) ?? []
        let now = Date()
        for card in cards {
            card.apply(.new(now: now))
            card.recognitionAttempts = 0
            card.recognitionCorrect = 0
            card.recognitionWindow = []
            card.computeAttempts = 0
            card.computeCorrect = 0
            card.computeWindow = []
            card.emaSeconds = nil
            card.bestSeconds = nil
            card.timeLimitSeconds = nil
        }

        settings?.newCardsIssuedToday = 0
        settings?.lastNewCardsDate = nil
        try? modelContext.save()
    }
}
