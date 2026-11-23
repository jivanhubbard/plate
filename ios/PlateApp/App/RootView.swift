import SwiftUI

struct RootView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @State private var isSignedIn = false

    var body: some View {
        Group {
            if isSignedIn {
                TabView {
                    DashboardView {
                        Task {
                            try? await supabase.signOut()
                            isSignedIn = false
                        }
                    }
                    .tabItem { Label("Dashboard", systemImage: "chart.bar") }

                    ImportedWorkoutListView()
                        .tabItem { Label("Workouts", systemImage: "figure.run") }

                    CatalogSearchView()
                        .tabItem { Label("Food search", systemImage: "magnifyingglass") }

                    NutritionFactsCaptureView()
                        .tabItem { Label("Label scan", systemImage: "text.viewfinder") }

                    FoodPhotoEstimatePlaceholderView()
                        .tabItem { Label("Food photo", systemImage: "camera") }
                }
            } else {
                SignInView {
                    isSignedIn = true
                }
            }
        }
    }
}
