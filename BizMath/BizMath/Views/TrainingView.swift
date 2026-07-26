import SwiftUI
import SwiftData

/// Вкладка «Тренировка»: общая очередь по всем модулям, отобранная FSRS.
struct TrainingView: View {
    @Environment(\.modelContext) private var modelContext
    let settings: AppSettings

    @State private var session: TrainingSession?

    var body: some View {
        NavigationStack {
            Group {
                if let session {
                    TrainingSessionRunner(session: session)
                } else {
                    SwiftUI.ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(.systemGroupedBackground))
                }
            }
            .navigationTitle("Тренировка")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if let session, session.phase != .idle, session.phase != .finished {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Завершить") { session.finish() }
                            .font(.subheadline)
                    }
                }
            }
        }
        .task {
            guard session == nil else { return }
            let new = TrainingSession(context: modelContext, settings: settings)
            new.start()
            session = new
        }
        .onDisappear { session?.stop() }
    }
}
