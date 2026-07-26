import SwiftUI
import SwiftData

struct RootView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var settings: AppSettings?

    var body: some View {
        Group {
            if let settings {
                MainTabView(settings: settings)
            } else {
                VStack(spacing: 12) {
                    SwiftUI.ProgressView()
                    Text("Готовим карточки…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .task {
            guard settings == nil else { return }
            ContentSeeder.sync(context: modelContext)
            settings = AppSettings.ensure(in: modelContext)
        }
    }
}

struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    let settings: AppSettings

    @State private var dueBadge = 0

    var body: some View {
        TabView {
            TrainingView(settings: settings)
                .tabItem { Label("Тренировка", systemImage: "bolt.fill") }
                .badge(dueBadge)

            ProgressDashboardView()
                .tabItem { Label("Прогресс", systemImage: "chart.bar.fill") }

            ModulesView(settings: settings)
                .tabItem { Label("Программа", systemImage: "list.bullet.rectangle") }
        }
        .task {
            dueBadge = ReviewScheduler.dueCount(context: modelContext)
        }
    }
}
