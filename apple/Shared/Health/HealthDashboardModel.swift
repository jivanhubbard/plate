import Foundation
import PlateKit

/// Loads the synced health data from Supabase for display, keeping the last
/// successful result on disk so it shows immediately and while offline.
@MainActor
final class HealthDashboardModel: ObservableObject {
    struct Snapshot: Codable {
        var metrics: [DailyHealthMetrics]
        var workouts: [HealthWorkoutRecord]
        var syncStatuses: [HealthSyncStatus]
        var fetchedAt: Date
    }

    @Published private(set) var snapshot: Snapshot?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let cache = try? JSONFileCache<Snapshot>(named: "health-dashboard")
    private let daysToShow = 30

    init() {
        snapshot = cache?.load()
    }

    var metrics: [DailyHealthMetrics] { snapshot?.metrics ?? [] }
    var workouts: [HealthWorkoutRecord] { snapshot?.workouts ?? [] }
    var latestSync: HealthSyncStatus? { snapshot?.syncStatuses.first }

    /// The most recent day that has a value for `keyPath`.
    func latest<T>(_ keyPath: KeyPath<DailyHealthMetrics, T?>) -> (day: DayKey, value: T)? {
        for day in metrics {
            if let value = day[keyPath: keyPath] { return (day.date, value) }
        }
        return nil
    }

    /// Mean of the values for `keyPath` over the days shown, ignoring gaps.
    func average(_ keyPath: KeyPath<DailyHealthMetrics, Double?>, lastDays: Int = 7) -> Double? {
        let values = metrics.prefix(lastDays).compactMap { $0[keyPath: keyPath] }
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }

    func refresh(using supabase: SupabaseService) async {
        isLoading = true
        defer { isLoading = false }

        var calendar = Calendar.current
        calendar.timeZone = .current
        let since = DayKey(.now, calendar: calendar).adding(days: -(daysToShow - 1), calendar: calendar)
        let sinceDate = since.startDate(in: calendar)

        do {
            async let metrics = supabase.fetchDailyMetrics(since: since)
            async let workouts = supabase.fetchHealthWorkouts(since: sinceDate)
            async let statuses = supabase.fetchSyncStatuses()
            let fresh = Snapshot(
                metrics: try await metrics,
                workouts: try await workouts,
                syncStatuses: try await statuses,
                fetchedAt: .now
            )
            snapshot = fresh
            errorMessage = nil
            try? cache?.save(fresh)
        } catch {
            errorMessage = Self.message(for: error)
        }
    }

    func clearCache() {
        cache?.clear()
        snapshot = nil
    }

    private static func message(for error: Error) -> String {
        let text = error.localizedDescription
        if text.contains("health_daily_metrics") || text.contains("health_sync_status") {
            return "The health tables are not installed yet. Run supabase/migrations/add_health_sync.sql in the Supabase SQL editor, then reload the API schema."
        }
        return text
    }
}
