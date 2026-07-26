import SwiftUI
import SwiftData

@main
struct BizMathApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: TrainingModule.self, Card.self, Attempt.self, AppSettings.self
            )
        } catch {
            fatalError("Не удалось открыть локальное хранилище: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(container)
    }
}
