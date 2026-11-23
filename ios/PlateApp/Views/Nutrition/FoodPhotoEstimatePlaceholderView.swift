import SwiftUI

struct FoodPhotoEstimatePlaceholderView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("Food-photo estimate unavailable", systemImage: "camera")
            } description: {
                Text("A macro estimate requires a configured vision endpoint. Plate does not pretend to infer macros locally from a meal photo.")
            } actions: {
                Text("The FoodPhotoEstimating protocol is the integration boundary for a future service.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Food photo")
        }
    }
}
