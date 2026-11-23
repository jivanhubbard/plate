import Foundation

/// Decides which days the iPhone re-reads from Apple Health on each sync.
///
/// Apple Health is the source of truth and every upload is an idempotent
/// upsert, so re-reading a day is always safe. That removes the need for an
/// upload queue: if an upload fails, the last-successful-sync date does not
/// advance and the next sync simply covers those days again.
public enum HealthSyncWindow {
    /// - Parameters:
    ///   - lastSuccessfulSync: When the last sync fully uploaded, or nil for the first sync.
    ///   - initialBackfillDays: How far back the very first sync reads.
    ///   - overlapDays: Extra days re-read before the last sync, to pick up
    ///     samples that reached Health late (for example a Watch that synced
    ///     the next morning).
    public static func days(
        lastSuccessfulSync: Date?,
        now: Date,
        calendar: Calendar,
        initialBackfillDays: Int = 90,
        overlapDays: Int = 2
    ) -> ClosedRange<DayKey> {
        let today = DayKey(now, calendar: calendar)
        let earliestAllowed = today.adding(days: -(initialBackfillDays - 1), calendar: calendar)

        guard let lastSuccessfulSync else {
            return earliestAllowed...today
        }

        let lastDay = min(DayKey(lastSuccessfulSync, calendar: calendar), today)
        let start = max(lastDay.adding(days: -overlapDays, calendar: calendar), earliestAllowed)
        return start...today
    }

    /// Every day in `range`, oldest first.
    public static func allDays(in range: ClosedRange<DayKey>, calendar: Calendar) -> [DayKey] {
        var days: [DayKey] = []
        var day = range.lowerBound
        while day <= range.upperBound {
            days.append(day)
            day = day.adding(days: 1, calendar: calendar)
        }
        return days
    }
}
