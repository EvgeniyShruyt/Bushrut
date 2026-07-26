import Foundation

/// Детерминированный ГПСЧ (SplitMix64). Один и тот же сид всегда даёт одну и ту же задачу —
/// это нужно, чтобы разбирать ошибку по сохранённой попытке и чтобы тесты были воспроизводимы.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        self.state = seed == 0 ? 0x9E3779B97F4A7C15 : seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

/// Обёртка с прикладными хелперами: «неровные» суммы, проценты, выбор из списка.
///
/// Числа намеренно не круглые: 1 240 ₽, 38 %, 4 730 шт — как в реальных прайсах и отчётах.
/// Круглые учебные числа позволяют угадывать ответ и не тренируют устный счёт.
final class Randomizer {
    private var generator: SeededGenerator
    let seed: UInt64

    init(seed: UInt64) {
        self.seed = seed
        self.generator = SeededGenerator(seed: seed)
    }

    func int(_ range: ClosedRange<Int>) -> Int {
        Int.random(in: range, using: &generator)
    }

    func double(_ range: ClosedRange<Double>) -> Double {
        Double.random(in: range, using: &generator)
    }

    func bool() -> Bool {
        Bool.random(using: &generator)
    }

    func pick<T>(_ items: [T]) -> T {
        precondition(!items.isEmpty, "Randomizer.pick: пустой массив")
        return items[int(0...(items.count - 1))]
    }

    func shuffled<T>(_ items: [T]) -> [T] {
        items.shuffled(using: &generator)
    }

    /// Несколько разных элементов без повторов.
    func sample<T>(_ items: [T], count: Int) -> [T] {
        Array(shuffled(items).prefix(count))
    }

    /// Сумма в рублях с шагом `step` — «неровная», но правдоподобная для прайса.
    func money(_ range: ClosedRange<Int>, step: Int = 10) -> Double {
        let steps = int((range.lowerBound / step)...(range.upperBound / step))
        return Double(steps * step)
    }

    /// Процент с одним знаком после запятой либо целый.
    func percent(_ range: ClosedRange<Double>, step: Double = 1) -> Double {
        let lo = Int((range.lowerBound / step).rounded())
        let hi = Int((range.upperBound / step).rounded())
        return Double(int(lo...hi)) * step
    }

    /// Целое количество штук.
    func units(_ range: ClosedRange<Int>, step: Int = 1) -> Int {
        int((range.lowerBound / step)...(range.upperBound / step)) * step
    }
}
