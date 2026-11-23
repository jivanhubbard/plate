import Foundation
import PlateKit
import UIKit

/// Reads Apple Health and uploads it to Supabase. Runs when the user taps
/// Sync, when the app comes to the foreground, and when HealthKit wakes the
/// app in the background with new data.
@MainActor
final class HealthSyncCoordinator: ObservableObject {
    enum Trigger {
        case manual, foreground, background

        /// Minimum time since the last successful sync before this trigger
        /// runs another one.
        var minimumInterval: TimeInterval {
            switch self {
            case .manual: 0
            case .foreground: 2 * 60
            case .background: 5 * 60
            }
        }
    }

    struct Result {
        let days: Int
        let workouts: Int
        let finishedAt: Date
    }

    @Published private(set) var isSyncing = false
    @Published private(set) var lastResult: Result?
    @Published private(set) var lastError: String?
    @Published private(set) var needsAuthorization = true

    private let supabase: SupabaseService
    private let health: HealthKitService
    private let defaults: UserDefaults

    init(supabase: SupabaseService, health: HealthKitService = .shared, defaults: UserDefaults = .standard) {
        self.supabase = supabase
        self.health = health
        self.defaults = defaults
    }

    var isHealthAvailable: Bool { HealthKitService.isAvailable }

    func refreshAuthorizationState() async {
        needsAuthorization = await health.needsAuthorizationRequest()
    }

    func connect() async {
        do {
            try await health.requestAuthorization()
            await refreshAuthorizationState()
            startBackgroundObservers()
            await sync(trigger: .manual)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Safe to call on every launch; only registers once the user has been
    /// asked for Health access.
    func startBackgroundObservers() {
        guard defaults.bool(forKey: Keys.observersEnabled) || !needsAuthorization else { return }
        defaults.set(true, forKey: Keys.observersEnabled)
        guard !observersStarted else { return }
        observersStarted = true
        health.startObserving { [weak self] in
            await self?.sync(trigger: .background)
        }
    }

    private var observersStarted = false

    func sync(trigger: Trigger) async {
        guard isHealthAvailable, !isSyncing else { return }

        let userID: UUID
        do {
            userID = try await supabase.currentUserID()
        } catch {
            if trigger == .manual { lastError = error.localizedDescription }
            return
        }

        let lastSuccess = defaults.object(forKey: Keys.lastSuccess(userID)) as? Date
        if let lastSuccess, Date.now.timeIntervalSince(lastSuccess) < trigger.minimumInterval {
            return
        }

        isSyncing = true
        defer { isSyncing = false }

        // Keep running briefly if the user leaves the app mid-sync.
        let backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "HealthSync")
        defer { UIApplication.shared.endBackgroundTask(backgroundTask) }

        let calendar = Calendar.current
        let now = Date.now
        let days = HealthSyncWindow.days(lastSuccessfulSync: lastSuccess, now: now, calendar: calendar)

        do {
            let metrics = try await health.dailyMetrics(for: days, calendar: calendar).filter { !$0.isEmpty }
            let workouts = try await health.workouts(
                from: days.lowerBound.startDate(in: calendar),
                to: now
            )

            try await supabase.upsertDailyMetrics(metrics)
            try await supabase.upsertWorkouts(workouts)
            try await supabase.recordSyncStatus(HealthSyncStatus(
                deviceID: Self.deviceID,
                deviceName: UIDevice.current.model,
                lastSyncedAt: now,
                syncedFrom: days.lowerBound,
                syncedThrough: days.upperBound
            ))

            defaults.set(now, forKey: Keys.lastSuccess(userID))
            lastResult = Result(days: metrics.count, workouts: workouts.count, finishedAt: now)
            lastError = nil
        } catch {
            lastError = Self.message(for: error)
        }
    }

    /// Forget sync progress so the next sync re-reads the full backfill.
    func resetSyncHistory() async {
        guard let userID = try? await supabase.currentUserID() else { return }
        defaults.removeObject(forKey: Keys.lastSuccess(userID))
    }

    private static var deviceID: String {
        UIDevice.current.identifierForVendor?.uuidString ?? "unknown-ios-device"
    }

    private static func message(for error: Error) -> String {
        let text = error.localizedDescription
        if text.contains("health_daily_metrics") || text.contains("health_sync_status") {
            return "The health tables are not installed yet. Run supabase/migrations/add_health_sync.sql in the Supabase SQL editor, then reload the API schema."
        }
        if text.contains("workouts") && text.contains("schema cache") {
            return "The workouts table is not installed yet. Run supabase/migrations/add_workouts_and_insights.sql, then add_health_sync.sql."
        }
        return text
    }

    private enum Keys {
        static let observersEnabled = "healthSync.observersEnabled"
        static func lastSuccess(_ userID: UUID) -> String { "healthSync.lastSuccess.\(userID.uuidString)" }
    }
}
