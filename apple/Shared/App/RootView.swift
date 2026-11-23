import SwiftUI

struct RootView: View {
    private enum AuthState { case checking, signedOut, signedIn }

    @EnvironmentObject private var supabase: SupabaseService
    @State private var authState = AuthState.checking

    var body: some View {
        switch authState {
        case .checking:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .task {
                    authState = await supabase.restoreSession() ? .signedIn : .signedOut
                }
        case .signedOut:
            SignInView { authState = .signedIn }
        case .signedIn:
            MainView {
                Task {
                    try? await supabase.signOut()
                    authState = .signedOut
                }
            }
        }
    }
}

private enum Section: String, CaseIterable, Identifiable {
    case health, foodSearch, labelScan

    var id: Self { self }

    var title: String {
        switch self {
        case .health: "Health"
        case .foodSearch: "Food search"
        case .labelScan: "Label scan"
        }
    }

    var systemImage: String {
        switch self {
        case .health: "heart.text.square"
        case .foodSearch: "magnifyingglass"
        case .labelScan: "text.viewfinder"
        }
    }
}

private struct MainView: View {
    let onSignOut: () -> Void

    @StateObject private var dashboard = HealthDashboardModel()

    #if os(macOS)
    @State private var selection: Section? = .health
    #endif

    var body: some View {
        #if os(iOS)
        TabView {
            ForEach(Section.allCases) { section in
                NavigationStack {
                    content(for: section)
                        .navigationTitle(section.title)
                        .toolbar { signOutButton }
                }
                .tabItem { Label(section.title, systemImage: section.systemImage) }
            }
        }
        #else
        NavigationSplitView {
            List(Section.allCases, selection: $selection) { section in
                Label(section.title, systemImage: section.systemImage)
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 200)
        } detail: {
            NavigationStack {
                content(for: selection ?? .health)
                    .navigationTitle((selection ?? .health).title)
            }
        }
        .toolbar { signOutButton }
        #endif
    }

    @ViewBuilder
    private func content(for section: Section) -> some View {
        switch section {
        case .health:
            #if os(iOS)
            HealthSyncView(dashboard: dashboard)
            #else
            HealthDashboardView(model: dashboard)
            #endif
        case .foodSearch:
            CatalogSearchView()
        case .labelScan:
            NutritionFactsCaptureView()
        }
    }

    private var signOutButton: some ToolbarContent {
        ToolbarItem(placement: .automatic) {
            Button("Sign out") {
                // Don't leave one person's health data on disk for the next.
                dashboard.clearCache()
                onSignOut()
            }
        }
    }
}
