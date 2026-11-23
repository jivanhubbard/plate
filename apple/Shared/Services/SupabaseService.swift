import Combine
import Foundation
import PlateKit
import Supabase

enum SupabaseServiceError: LocalizedError {
    case notSignedIn

    var errorDescription: String? {
        "You are signed out. Sign in to sync with Plate."
    }
}

@MainActor
final class SupabaseService: ObservableObject {
    let client: SupabaseClient?
    @Published private(set) var configurationError: String?

    init(configuration: AppConfiguration? = try? AppConfiguration.load()) {
        if let configuration {
            client = SupabaseClient(
                supabaseURL: configuration.supabaseURL,
                supabaseKey: configuration.supabaseAnonKey
            )
            configurationError = nil
        } else {
            client = nil
            configurationError = "Supabase is not configured. Copy Config.xcconfig.example to Config.xcconfig and add local credentials."
        }
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        try await requireClient().auth.signIn(email: email, password: password)
    }

    func signOut() async throws {
        guard let client else { return }
        try await client.auth.signOut()
    }

    /// True when a stored session exists (refreshing it if it has expired).
    func restoreSession() async -> Bool {
        guard let client else { return false }
        return (try? await client.auth.session) != nil
    }

    func currentUserID() async throws -> UUID {
        guard let session = try? await requireClient().auth.session else {
            throw SupabaseServiceError.notSignedIn
        }
        return session.user.id
    }

    // MARK: - Food catalog

    func searchCatalog(_ query: String, limit: Int = 20) async throws -> [CatalogFood] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedQuery.count >= 2 else { return [] }

        return try await requireClient()
            .rpc(
                "search_branded_foods",
                params: SearchCatalogParams(
                    searchQuery: normalizedQuery,
                    resultLimit: min(max(limit, 1), 50)
                )
            )
            .execute()
            .value
    }

    static func catalogSearchErrorMessage(from error: Error) -> String {
        let message = error.localizedDescription.lowercased()
        if message.contains("search_branded_foods") && message.contains("schema cache") {
            return """
            The branded-food catalog is not installed in this Supabase project yet.

            In the Supabase SQL editor, run:
            supabase/migrations/add_branded_food_catalog.sql

            Then reload the API schema (Settings → API → Reload schema) and try again.
            """
        }
        return error.localizedDescription
    }

    // MARK: - Health sync (written by the iPhone)

    private static let upsertChunkSize = 200

    func upsertDailyMetrics(_ rows: [DailyHealthMetrics]) async throws {
        let userID = try await currentUserID()
        let owned = rows.map { row -> DailyHealthMetrics in
            var row = row
            row.userID = userID
            return row
        }
        for chunk in owned.chunked(into: Self.upsertChunkSize) {
            try await requireClient()
                .from("health_daily_metrics")
                .upsert(chunk, onConflict: "user_id,date")
                .execute()
        }
    }

    func upsertWorkouts(_ rows: [HealthWorkoutRecord]) async throws {
        let userID = try await currentUserID()
        let owned = rows.map { row -> HealthWorkoutRecord in
            var row = row
            row.userID = userID
            return row
        }
        for chunk in owned.chunked(into: Self.upsertChunkSize) {
            try await requireClient()
                .from("workouts")
                .upsert(chunk, onConflict: "user_id,healthkit_uuid")
                .execute()
        }
    }

    func recordSyncStatus(_ status: HealthSyncStatus) async throws {
        var status = status
        status.userID = try await currentUserID()
        try await requireClient()
            .from("health_sync_status")
            .upsert(status, onConflict: "user_id,device_id")
            .execute()
    }

    // MARK: - Health reads (used by both apps)

    func fetchDailyMetrics(since day: DayKey) async throws -> [DailyHealthMetrics] {
        try await requireClient()
            .from("health_daily_metrics")
            .select()
            .gte("date", value: day.description)
            .order("date", ascending: false)
            .execute()
            .value
    }

    func fetchHealthWorkouts(since date: Date, limit: Int = 100) async throws -> [HealthWorkoutRecord] {
        try await requireClient()
            .from("workouts")
            .select(
                "user_id,healthkit_uuid,source_bundle_id,raw_activity_type,display_name," +
                "started_at,ended_at,duration_seconds,active_calories,distance_meters,average_heart_rate"
            )
            .not("healthkit_uuid", operator: .is, value: "null")
            .gte("started_at", value: date.ISO8601Format())
            .order("started_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetchSyncStatuses() async throws -> [HealthSyncStatus] {
        try await requireClient()
            .from("health_sync_status")
            .select()
            .order("last_synced_at", ascending: false)
            .execute()
            .value
    }

    // MARK: - Helpers

    private func requireClient() throws -> SupabaseClient {
        guard let client else {
            throw ConfigurationError.missingValue("Supabase configuration")
        }
        return client
    }
}

private struct SearchCatalogParams: Encodable, Sendable {
    let searchQuery: String
    let resultLimit: Int

    enum CodingKeys: String, CodingKey {
        case searchQuery = "search_query"
        case resultLimit = "result_limit"
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}
