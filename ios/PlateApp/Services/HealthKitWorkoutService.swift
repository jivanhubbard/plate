import Foundation
import HealthKit

enum HealthKitWorkoutError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Health data is unavailable on this device."
        }
    }
}

final class HealthKitWorkoutService {
    private let store = HKHealthStore()

    func requestReadAccess() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitWorkoutError.unavailable
        }
        try await store.requestAuthorization(toShare: [], read: [HKObjectType.workoutType()])
    }

    func importRecentWorkouts(limit: Int = 30) async throws -> [ImportedWorkout] {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: nil,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let workouts = (samples as? [HKWorkout]) ?? []
                continuation.resume(returning: workouts.map(Self.mapWorkout))
            }
            store.execute(query)
        }
    }

    private static func mapWorkout(_ workout: HKWorkout) -> ImportedWorkout {
        ImportedWorkout(
            id: workout.uuid,
            healthKitIdentifier: workout.uuid.uuidString,
            startedAt: workout.startDate,
            durationSeconds: workout.duration,
            activityName: activityName(for: workout.workoutActivityType),
            classification: suggestedClassification(for: workout.workoutActivityType)
        )
    }

    private static func activityName(for type: HKWorkoutActivityType) -> String {
        switch type {
        case .traditionalStrengthTraining, .functionalStrengthTraining:
            return "Strength Training"
        case .running:
            return "Running"
        case .walking:
            return "Walking"
        case .cycling:
            return "Cycling"
        case .yoga:
            return "Yoga"
        default:
            return "Workout"
        }
    }

    private static func suggestedClassification(for type: HKWorkoutActivityType) -> WorkoutClassification {
        switch type {
        case .traditionalStrengthTraining, .functionalStrengthTraining:
            return .strength
        case .running, .walking, .cycling, .swimming:
            return .cardio
        case .yoga, .pilates, .flexibility:
            return .mobility
        default:
            return .other
        }
    }
}
