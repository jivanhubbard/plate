import SwiftUI

@main
struct PlateApp: App {
    #if os(iOS)
    @UIApplicationDelegateAdaptor(PlateAppDelegate.self) private var appDelegate
    #endif

    @StateObject private var supabase = AppEnvironment.shared.supabase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(supabase)
        }
        #if os(macOS)
        .defaultSize(width: 1000, height: 700)
        #endif
    }
}
