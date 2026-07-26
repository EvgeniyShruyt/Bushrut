import Foundation
import Observation
import SwiftData

/// Движок тренировки: очередь карточек, два шага на каждой (распознавание → расчёт),
/// таймер, запись попытки и планирование следующего показа по FSRS.
@Observable
@MainActor
final class TrainingSession {

    enum Phase: Equatable {
        /// Сессия ещё не начата или очередь пуста.
        case idle
        /// Шаг 1: выбрать инструмент. Считать пока нечего.
        case classify
        /// Шаг 2: посчитать. Здесь работает лимит времени.
        case compute
        /// Разбор: что верно, что нет, интуиция, оценка для FSRS.
        case feedback
        case finished
    }

    struct Outcome {
        var toolCorrect: Bool
        var answerCorrect: Bool
        var withinTimeLimit: Bool
        var answerGiven: Double?
        var suggestedRating: FSRSRating
        var nextIntervals: [FSRSRating: TimeInterval]
    }

    struct SessionStats {
        var answered = 0
        var recognitionCorrect = 0
        var computeCorrect = 0
        var clean = 0
        var totalSeconds: Double = 0

        var recognitionAccuracy: Double { answered == 0 ? 0 : Double(recognitionCorrect) / Double(answered) }
        var computeAccuracy: Double { answered == 0 ? 0 : Double(computeCorrect) / Double(answered) }
    }

    // MARK: - Состояние

    private(set) var phase: Phase = .idle
    private(set) var queue: [Card] = []
    private(set) var position: Int = 0
    private(set) var plannedCount: Int = 0
    private(set) var newCount: Int = 0
    private(set) var dueCount: Int = 0

    private(set) var currentCard: Card?
    private(set) var currentTask: GeneratedTask?
    private(set) var timeLimit: Double?
    private(set) var elapsed: TimeInterval = 0
    private(set) var chosenTool: ToolKind?
    private(set) var outcome: Outcome?
    private(set) var stats = SessionStats()

    /// Ввод пользователя на шаге расчёта.
    var answerText: String = ""

    private let context: ModelContext
    private let settings: AppSettings
    private let scheduler: FSRSScheduler

    private var phaseStartedAt: Date?
    private var classifySeconds: Double = 0
    private var ticker: Timer?

    init(context: ModelContext, settings: AppSettings) {
        self.context = context
        self.settings = settings
        var parameters = FSRSParameters.default
        parameters.desiredRetention = settings.desiredRetention
        self.scheduler = FSRSScheduler(parameters: parameters)
    }

    // MARK: - Жизненный цикл сессии

    /// Вызывается при уходе с экрана: гасит таймер, чтобы он не тикал в фоне.
    func stop() {
        stopTicker()
    }

    func start(moduleID: String? = nil) {
        let built = ReviewScheduler.buildQueue(context: context, settings: settings, moduleID: moduleID)
        queue = built.cards
        dueCount = built.dueCount
        newCount = built.newCount
        plannedCount = built.cards.count
        position = 0
        stats = SessionStats()
        guard !queue.isEmpty else {
            phase = .idle
            return
        }
        loadCurrent()
    }

    func finish() {
        stopTicker()
        phase = .finished
        currentCard = nil
        currentTask = nil
    }

    private func loadCurrent() {
        guard position < queue.count else {
            finish()
            return
        }
        let card = queue[position]
        guard let task = TemplateRegistry.generate(templateID: card.templateID) else {
            // Шаблон исчез — пропускаем карточку, не ломая сессию.
            position += 1
            loadCurrent()
            return
        }
        currentCard = card
        currentTask = task
        chosenTool = nil
        outcome = nil
        answerText = ""
        classifySeconds = 0
        timeLimit = TimingPolicy.limit(for: card, task: task, settings: settings)
        phase = .classify
        beginTiming()
    }

    // MARK: - Шаг 1: выбор инструмента

    /// Выбор инструмента фиксируется сразу — вернуться и передумать после подсказки нельзя,
    /// иначе ось «распознавание» перестаёт что-либо измерять.
    func selectTool(_ tool: ToolKind) {
        guard phase == .classify else { return }
        chosenTool = tool
        classifySeconds = currentElapsed()
        phase = .compute
        beginTiming()
    }

    // MARK: - Шаг 2: расчёт

    func submitAnswer() {
        guard phase == .compute, let card = currentCard, let task = currentTask else { return }
        let computeSeconds = currentElapsed()
        stopTicker()

        let given = Fmt.parseAnswer(answerText)
        let answerCorrect = given.map { task.tolerance.matches($0, expected: task.answer) } ?? false
        let toolCorrect = chosenTool == task.correctTool
        let withinLimit = timeLimit.map { computeSeconds <= $0 } ?? true

        let rating = suggestRating(
            toolCorrect: toolCorrect,
            answerCorrect: answerCorrect,
            withinLimit: withinLimit,
            seconds: computeSeconds,
            task: task
        )

        outcome = Outcome(
            toolCorrect: toolCorrect,
            answerCorrect: answerCorrect,
            withinTimeLimit: withinLimit,
            answerGiven: given,
            suggestedRating: rating,
            nextIntervals: scheduler.previewIntervals(state: card.fsrsState)
        )
        phase = .feedback
    }

    /// Сдаться: попытка засчитывается как проваленный расчёт, ответ показывается.
    func giveUp() {
        guard phase == .compute else { return }
        answerText = ""
        submitAnswer()
    }

    // MARK: - Оценка и переход дальше

    func commit(rating: FSRSRating) {
        guard let card = currentCard, let task = currentTask, let outcome else { return }
        let now = Date()
        let computeSeconds = max(0, elapsed)

        let wasNew = card.schedulingState == .new
        let nextState = scheduler.review(state: card.fsrsState, rating: rating, now: now)
        let intervalDays = nextState.due.timeIntervalSince(now) / 86_400

        let attempt = Attempt(
            date: now,
            templateID: card.templateID,
            moduleID: card.moduleID,
            seed: task.seed,
            chosenTool: chosenTool,
            correctTool: task.correctTool,
            classifySeconds: classifySeconds,
            answerGiven: outcome.answerGiven,
            answerExpected: task.answer,
            answerCorrect: outcome.answerCorrect,
            computeSeconds: computeSeconds,
            timeLimitSeconds: timeLimit,
            rating: rating,
            scheduledIntervalDays: intervalDays
        )
        attempt.card = card
        context.insert(attempt)

        // Две оси обновляются независимо друг от друга.
        card.pushRecognition(correct: outcome.toolCorrect)
        card.pushCompute(correct: outcome.answerCorrect, seconds: computeSeconds)
        card.timeLimitSeconds = TimingPolicy.updatedLimit(
            for: card,
            task: task,
            settings: settings,
            lastAttemptCorrect: outcome.answerCorrect,
            lastAttemptSeconds: computeSeconds
        )
        card.apply(nextState)

        if wasNew {
            settings.rollDailyCounterIfNeeded(now: now)
            settings.newCardsIssuedToday += 1
            settings.lastNewCardsDate = now
        }

        stats.answered += 1
        if outcome.toolCorrect { stats.recognitionCorrect += 1 }
        if outcome.answerCorrect { stats.computeCorrect += 1 }
        if outcome.toolCorrect && outcome.answerCorrect && outcome.withinTimeLimit { stats.clean += 1 }
        stats.totalSeconds += classifySeconds + computeSeconds

        try? context.save()

        // Провал — карточка возвращается в конец этой же сессии (если её там ещё нет).
        if rating == .again {
            let queuedLater = queue.indices.contains { $0 > position && queue[$0] === card }
            if !queuedLater { queue.append(card) }
        }

        position += 1
        loadCurrent()
    }

    private func suggestRating(
        toolCorrect: Bool,
        answerCorrect: Bool,
        withinLimit: Bool,
        seconds: Double,
        task: GeneratedTask
    ) -> FSRSRating {
        if !answerCorrect { return .again }
        if !toolCorrect { return .hard }
        if !withinLimit { return .hard }
        let benchmark = timeLimit ?? task.baseSeconds
        return seconds <= benchmark * 0.6 ? .easy : .good
    }

    // MARK: - Таймер

    private func beginTiming() {
        phaseStartedAt = Date()
        elapsed = 0
        startTicker()
    }

    private func currentElapsed() -> Double {
        guard let start = phaseStartedAt else { return 0 }
        return Date().timeIntervalSince(start)
    }

    private func startTicker() {
        stopTicker()
        let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.elapsed = self.currentElapsed()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func stopTicker() {
        elapsed = currentElapsed()
        ticker?.invalidate()
        ticker = nil
    }

    // MARK: - Производные для UI

    var remainingSeconds: Double? {
        guard let timeLimit, phase == .compute else { return nil }
        return timeLimit - elapsed
    }

    var isOvertime: Bool {
        guard let remaining = remainingSeconds else { return false }
        return remaining < 0
    }

    var progressFraction: Double {
        plannedCount == 0 ? 0 : min(1, Double(position) / Double(max(plannedCount, queue.count)))
    }
}
