import SwiftUI

struct DashboardView: View {
    let onSignOut: () -> Void

    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Dashboard scaffold",
                systemImage: "chart.bar",
                description: Text("Daily nutrition and workout summaries will appear here.")
            )
            .navigationTitle("Dashboard")
            .toolbar {
                Button("Sign out", action: onSignOut)
            }
        }
    }
}
