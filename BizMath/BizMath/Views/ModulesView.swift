import SwiftUI
import SwiftData

/// Программа: шесть модулей, их карточки и бэклог будущих карточек.
/// Отсюда же запускается прогон отдельного модуля.
struct ModulesView: View {
    @Environment(\.modelContext) private var modelContext
    let settings: AppSettings

    @Query(sort: [SortDescriptor(\TrainingModule.order)]) private var modules: [TrainingModule]

    var body: some View {
        NavigationStack {
            List {
                ForEach(modules) { module in
                    NavigationLink {
                        ModuleDetailView(module: module, settings: settings)
                    } label: {
                        moduleRow(module)
                    }
                }

                Section {
                    Text("Все расчёты и расписание повторений работают локально на устройстве. Сети и внешних сервисов нет.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Программа")
        }
    }

    private func moduleRow(_ module: TrainingModule) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: module.symbolName)
                .font(.title3)
                .frame(width: 30)
                .foregroundStyle(module.isContentReady ? Color.accentColor : Color.secondary)

            VStack(alignment: .leading, spacing: 4) {
                Text("\(module.order). \(module.title)")
                    .font(.subheadline.weight(.semibold))
                Text(module.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 8) {
                    if module.isContentReady {
                        Label("\(module.activeCards.count) карточек", systemImage: "rectangle.stack")
                        if module.dueCardsCount > 0 {
                            Label("\(module.dueCardsCount) к повтору", systemImage: "clock")
                                .foregroundStyle(Color.accentColor)
                        }
                    } else {
                        Label("заготовка · \(module.backlogCount) в плане", systemImage: "hammer")
                            .foregroundStyle(.orange)
                    }
                }
                .font(.caption2)
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Детали модуля

struct ModuleDetailView: View {
    @Environment(\.modelContext) private var modelContext
    let module: TrainingModule
    let settings: AppSettings

    @State private var drillSession: TrainingSession?
    @State private var isDrilling = false

    private var cards: [Card] {
        module.activeCards.sorted { lhs, rhs in
            if lhs.difficulty != rhs.difficulty { return lhs.difficulty < rhs.difficulty }
            return lhs.order < rhs.order
        }
    }

    private var backlog: [TemplateBacklogItem] {
        TemplateRegistry.backlog(moduleID: module.id)
    }

    var body: some View {
        List {
            if !cards.isEmpty {
                Section("Карточки") {
                    ForEach(cards) { card in
                        cardRow(card)
                    }
                }
            }

            if !backlog.isEmpty {
                Section {
                    ForEach(backlog) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.title).font(.subheadline)
                                Spacer()
                                difficultyPips(item.difficulty)
                            }
                            Text(item.tool.title)
                                .font(.caption2)
                                .foregroundStyle(Color.accentColor)
                            Text(item.scenarioSketch)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text("В плане")
                } footer: {
                    Text("Заготовки под наполнение: сценарий описан, генератор ещё не написан. Добавьте шаблон с этим id — карточка появится автоматически.")
                }
            }
        }
        .navigationTitle(module.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !cards.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Прогнать") {
                        let session = TrainingSession(context: modelContext, settings: settings)
                        session.start(moduleID: module.id)
                        drillSession = session
                        isDrilling = true
                    }
                }
            }
        }
        .sheet(isPresented: $isDrilling, onDismiss: {
            drillSession?.stop()
            drillSession = nil
        }) {
            if let drillSession {
                NavigationStack {
                    ModuleDrillView(session: drillSession)
                }
            }
        }
    }

    private func cardRow(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(card.title).font(.subheadline)
                Spacer()
                difficultyPips(card.difficulty)
            }
            Text(card.tool.hint)
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                statChip("инструмент", card.recognitionAttempts == 0 ? "—" : Fmt.pct(card.recognitionAccuracy * 100, digits: 0), .blue)
                statChip("счёт", card.computeAttempts == 0 ? "—" : Fmt.pct(card.computeAccuracy * 100, digits: 0), .green)
                statChip("время", card.emaSeconds.map { "\(Int($0)) с" } ?? "—", .orange)
                Spacer()
                Text(card.schedulingState == .new ? "новая" : dueLabel(card))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func dueLabel(_ card: Card) -> String {
        let interval = card.due.timeIntervalSinceNow
        return interval <= 0 ? "к повтору" : "через \(Fmt.duration(interval))"
    }

    private func statChip(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value).font(.caption.weight(.semibold)).foregroundStyle(tint)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func difficultyPips(_ level: Int) -> some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { index in
                Circle()
                    .fill(index <= level ? Color.accentColor : Color(.tertiarySystemFill))
                    .frame(width: 5, height: 5)
            }
        }
    }
}

/// Прогон одного модуля — тот же движок, что и в основной тренировке.
private struct ModuleDrillView: View {
    @Environment(\.dismiss) private var dismiss
    let session: TrainingSession

    var body: some View {
        TrainingSessionRunner(session: session)
            .navigationTitle("Прогон модуля")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Закрыть") {
                        session.stop()
                        dismiss()
                    }
                }
            }
    }
}
