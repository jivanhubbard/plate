import SwiftUI

struct ImportedWorkoutListView: View {
    @State private var workouts: [ImportedWorkout] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let service = HealthKitWorkoutService()

    var body: some View {
        NavigationStack {
            List {
                if workouts.isEmpty && !isLoading {
                    ContentUnavailableView(
                        "No imported workouts",
                        systemImage: "figure.run",
                        description: Text("Grant Health access to review recent workouts.")
                    )
                }

                ForEach($workouts) { $workout in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(workout.activityName)
                            .font(.headline)
                        Text(workout.startedAt, format: .dateTime.month().day().hour().minute())
                            .foregroundStyle(.secondary)
                        Text(Duration.seconds(workout.durationSeconds).formatted(.units()))
                            .font(.caption)

                        Picker("Classification", selection: $workout.classification) {
                            Text("Unclassified").tag(WorkoutClassification?.none)
                            ForEach(WorkoutClassification.allCases) { classification in
                                Text(classification.title).tag(Optional(classification))
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .overlay {
                if isLoading { ProgressView("Importing workouts…") }
            }
            .navigationTitle("Imported workouts")
            .toolbar {
                Button("Import") {
                    Task { await loadWorkouts() }
                }
                .disabled(isLoading)
            }
            .refreshable {
                await loadWorkouts()
            }
            .alert(
                "Health import failed",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    @MainActor
    private func loadWorkouts() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await service.requestReadAccess()
            workouts = try await service.importRecentWorkouts()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
