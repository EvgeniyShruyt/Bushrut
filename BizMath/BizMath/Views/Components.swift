import SwiftUI

/// Карточка с деловым сценарием — то, что читается перед выбором инструмента.
struct ScenarioCard: View {
    let scenario: String
    let question: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(scenario)
                .font(.callout)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            Divider()

            Text(question)
                .font(.headline)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

/// Вариант инструмента на шаге распознавания.
struct ToolOptionButton: View {
    let tool: ToolKind
    let appearance: Appearance
    let action: () -> Void

    enum Appearance {
        case idle
        case chosenCorrect
        case chosenWrong
        case revealedCorrect
        case dimmed
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(tool.title)
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.leading)
                    Text(tool.hint)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                if let symbol {
                    Image(systemName: symbol)
                        .foregroundStyle(accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(background, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(accent.opacity(appearance == .idle ? 0 : 0.6), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .opacity(appearance == .dimmed ? 0.45 : 1)
    }

    private var symbol: String? {
        switch appearance {
        case .idle, .dimmed: return nil
        case .chosenCorrect, .revealedCorrect: return "checkmark.circle.fill"
        case .chosenWrong: return "xmark.circle.fill"
        }
    }

    private var accent: Color {
        switch appearance {
        case .chosenWrong: return .red
        case .chosenCorrect, .revealedCorrect: return .green
        default: return .accentColor
        }
    }

    private var background: Color {
        switch appearance {
        case .chosenWrong: return Color.red.opacity(0.10)
        case .chosenCorrect, .revealedCorrect: return Color.green.opacity(0.10)
        default: return Color(.secondarySystemGroupedBackground)
        }
    }
}

/// Плитка с одной метрикой.
struct StatTile: View {
    let title: String
    let value: String
    var caption: String?
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.weight(.semibold))
                .foregroundStyle(tint)
            if let caption {
                Text(caption)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// Горизонтальный индикатор одной оси навыка.
struct AxisBar: View {
    let title: String
    let subtitle: String
    /// 0…1
    let value: Double
    let display: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title).font(.subheadline.weight(.semibold))
                Spacer()
                Text(display).font(.subheadline.monospacedDigit()).foregroundStyle(tint)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(.tertiarySystemFill))
                    Capsule()
                        .fill(tint)
                        .frame(width: max(4, geo.size.width * min(max(value, 0), 1)))
                }
            }
            .frame(height: 8)
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

/// Плашка «верно/неверно» для одной из двух осей.
struct OutcomeBadge: View {
    let title: String
    let isCorrect: Bool
    let detail: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(isCorrect ? .green : .red)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            (isCorrect ? Color.green : Color.red).opacity(0.08),
            in: RoundedRectangle(cornerRadius: 12)
        )
    }
}

/// Пустое состояние — когда повторять нечего.
struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 44))
                .foregroundStyle(.tertiary)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 4)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
