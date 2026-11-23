import Foundation

public enum SleepStage: String, Codable, Sendable {
    case inBed, awake, asleepUnspecified, core, deep, rem

    public var isAsleep: Bool {
        switch self {
        case .asleepUnspecified, .core, .deep, .rem: return true
        case .inBed, .awake: return false
        }
    }
}

public struct SleepSample: Hashable, Sendable {
    public let start: Date
    public let end: Date
    public let stage: SleepStage

    public init(start: Date, end: Date, stage: SleepStage) {
        self.start = start
        self.end = end
        self.stage = stage
    }
}

public struct NightlySleep: Hashable, Sendable {
    public let day: DayKey
    /// Total minutes asleep across every sleep session that ended on `day`,
    /// including naps.
    public let asleepMinutes: Double
    /// Start and end of the longest session that day (the main sleep).
    public let mainSleepStart: Date
    public let mainSleepEnd: Date
}

/// Turns raw HealthKit sleep samples into one summary per day.
///
/// - Only asleep stages count; "in bed" and "awake" are ignored.
/// - Overlapping samples (for example an Apple Watch and a third-party app
///   both recording the same night) are merged so time is not counted twice.
/// - Asleep intervals separated by less than `sessionGap` form one session.
/// - A session belongs to the day it ends on, so last night's sleep is
///   attributed to this morning.
public enum SleepAggregator {
    public static func nights(
        from samples: [SleepSample],
        calendar: Calendar,
        sessionGap: TimeInterval = 2 * 60 * 60
    ) -> [DayKey: NightlySleep] {
        let intervals = mergedAsleepIntervals(samples)
        guard !intervals.isEmpty else { return [:] }

        // Group the disjoint intervals into sessions.
        var sessions: [[DateInterval]] = [[intervals[0]]]
        for interval in intervals.dropFirst() {
            let previousEnd = sessions[sessions.count - 1].last!.end
            if interval.start.timeIntervalSince(previousEnd) < sessionGap {
                sessions[sessions.count - 1].append(interval)
            } else {
                sessions.append([interval])
            }
        }

        struct Session {
            let start: Date
            let end: Date
            let asleep: TimeInterval
        }

        var byDay: [DayKey: [Session]] = [:]
        for group in sessions {
            let session = Session(
                start: group.first!.start,
                end: group.last!.end,
                asleep: group.reduce(0) { $0 + $1.duration }
            )
            byDay[DayKey(session.end, calendar: calendar), default: []].append(session)
        }

        return byDay.mapValues { daySessions in
            let main = daySessions.max { $0.asleep < $1.asleep }!
            let total = daySessions.reduce(0) { $0 + $1.asleep }
            return NightlySleep(
                day: DayKey(main.end, calendar: calendar),
                asleepMinutes: total / 60,
                mainSleepStart: main.start,
                mainSleepEnd: main.end
            )
        }
    }

    /// Sorted, non-overlapping intervals covering every asleep sample.
    static func mergedAsleepIntervals(_ samples: [SleepSample]) -> [DateInterval] {
        let asleep = samples
            .filter { $0.stage.isAsleep && $0.end > $0.start }
            .sorted { $0.start < $1.start }

        var merged: [DateInterval] = []
        for sample in asleep {
            if let last = merged.last, sample.start <= last.end {
                merged[merged.count - 1] = DateInterval(start: last.start, end: max(last.end, sample.end))
            } else {
                merged.append(DateInterval(start: sample.start, end: sample.end))
            }
        }
        return merged
    }
}
