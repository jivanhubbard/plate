import Foundation

/// Long-lived services shared by SwiftUI and, on iOS, the app delegate
/// (which must register HealthKit observers before any UI exists).
@MainActor
final class AppEnvironment {
    static let shared = AppEnvironment()

    let supabase = SupabaseService()

    #if os(iOS)
    private(set) lazy var healthSync = HealthSyncCoordinator(supabase: supabase)
    #endif

    private init() {}
}
