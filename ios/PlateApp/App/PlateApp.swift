import SwiftUI

@main
struct PlateApp: App {
    @StateObject private var supabase = SupabaseService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(supabase)
        }
    }
}
