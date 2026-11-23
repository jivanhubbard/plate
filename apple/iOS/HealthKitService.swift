import Foundation
import HealthKit
import PlateKit

enum HealthKitServiceError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "Apple Health is not available on this device."
    }
}

/// Reads Apple Health data and converts it to PlateKit records. Read-only:
/// Plate never writes to Health.
final class HealthKitService: @unchecked Sendable {
    static let shared = HealthKitService()

    private let store = HKHealthStore()

    static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private static let distanceTypes: [HKQuantityType] = [
        HKQuantityType(.distanceWalkingRunning),
        HKQuantityType(.distanceCycling),
        HKQuantityType(.distanceSwimming),
    ]

    private static let readTypes: Set<HKObjectType> = {
        var types: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.stepCount),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.heartRate),
            HKQuantityType(.bodyMass),
            HKQuantityType(.bodyFatPercentage),
        ]
        types.formUnion(distanceTypes)
        return types
    }()

    /// Types that wake the app in the background when new samples arrive.
    /// Steps and active energy change constantly, so they are picked up by
    /// these syncs and by opening the app rather than triggering their own.
    private static let observedTypes: [(HKSampleType, HKUpdateFrequency)] = [
        (HKObjectType.workoutType(), .immediate),
        (HKCategoryType(.sleepAnalysis), .hourly),
        (HKQuantityType(.heartRateVariabilitySDNN), .hourly),
        (HKQuantityType(.restingHeartRate), .hourly),
        (HKQuantityType(.bodyMass), .hourly),
    ]

    // MARK: - Authorization

    /// HealthKit never reveals whether read access was granted, only whether
    /// the permission sheet still needs to be shown.
    func needsAuthorizationRequest() async -> Bool {
        guard Self.isAvailable else { return false }
        let status = try? await store.statusForAuthorizationRequest(toShare: [], read: Self.readTypes)
        return status != .unnecessary
    }

    func requestAuthorization() async throws {
        guard Self.isAvailable else { throw HealthKitServiceError.unavailable }
        try await store.requestAuthorization(toShare: [], read: Self.readTypes)
    }

    // MARK: - Background delivery

    /// Registers observer queries and background delivery. Must be called on
    /// every launch (including background launches) so HealthKit can wake
    /// the app; `onUpdate` must finish before HealthKit is told we're done.
    func startObserving(onUpdate: @escaping @Sendable () async -> Void) {
        guard Self.isAvailable else { return }
        for (type, frequency) in Self.observedTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completionHandler, error in
                guard error == nil else {
                    completionHandler()
                    return
                }
                Task {
                    await onUpdate()
                    completionHandler()
                }
            }
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: frequency) { _, _ in }
        }
    }

    // MARK: - Daily metrics

    func dailyMetrics(for days: ClosedRange<DayKey>, calendar: Calendar) async throws -> [DailyHealthMetrics] {
        let start = days.lowerBound.startDate(in: calendar)
        let end = days.upperBound.adding(days: 1, calendar: calendar).startDate(in: calendar)

        let bpm = HKUnit.count().unitDivided(by: .minute())
        async let steps = dailyStatistics(.stepCount, .cumulativeSum, start, end, calendar) {
            $0.sumQuantity()?.doubleValue(for: .count())
        }
        async let energy = dailyStatistics(.activeEnergyBurned, .cumulativeSum, start, end, calendar) {
            $0.sumQuantity()?.doubleValue(for: .kilocalorie())
        }
        async let restingHR = dailyStatistics(.restingHeartRate, .discreteAverage, start, end, calendar) {
            $0.averageQuantity()?.doubleValue(for: bpm)
        }
        async let hrv = dailyStatistics(.heartRateVariabilitySDNN, .discreteAverage, start, end, calendar) {
            $0.averageQuantity()?.doubleValue(for: .secondUnit(with: .milli))
        }
        async let weight = dailyStatistics(.bodyMass, .mostRecent, start, end, calendar) {
            $0.mostRecentQuantity()?.doubleValue(for: .gramUnit(with: .kilo))
        }
        async let bodyFat = dailyStatistics(.bodyFatPercentage, .mostRecent, start, end, calendar) {
            $0.mostRecentQuantity()?.doubleValue(for: .percent())
        }
        async let sleep = nightlySleep(start: start, end: end, calendar: calendar)

        let (stepsByDay, energyByDay, restingByDay, hrvByDay, weightByDay, fatByDay, sleepByDay) =
            try await (steps, energy, restingHR, hrv, weight, bodyFat, sleep)

        let timeZone = calendar.timeZone.identifier
        return HealthSyncWindow.allDays(in: days, calendar: calendar).map { day in
            let night = sleepByDay[day]
            return DailyHealthMetrics(
                date: day,
                steps: stepsByDay[day].map { Int($0.rounded()) },
                activeEnergyKcal: energyByDay[day],
                restingHeartRate: restingByDay[day],
                hrvSDNNMilliseconds: hrvByDay[day],
                sleepAsleepMinutes: night?.asleepMinutes,
                sleepStart: night?.mainSleepStart,
                sleepEnd: night?.mainSleepEnd,
                weightKg: weightByDay[day],
                bodyFatPercentage: fatByDay[day],
                timeZone: timeZone
            )
        }
    }

    private func dailyStatistics(
        _ identifier: HKQuantityTypeIdentifier,
        _ options: HKStatisticsOptions,
        _ start: Date,
        _ end: Date,
        _ calendar: Calendar,
        value: @escaping @Sendable (HKStatistics) -> Double?
    ) async throws -> [DayKey: Double] {
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(
                type: HKQuantityType(identifier),
                predicate: HKQuery.predicateForSamples(withStart: start, end: end)
            ),
            options: options,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )

        let collection: HKStatisticsCollection
        do {
            collection = try await descriptor.result(for: store)
        } catch let error as HKError where error.code == .errorNoData {
            return [:]
        }

        var result: [DayKey: Double] = [:]
        collection.enumerateStatistics(from: start, to: end) { statistics, _ in
            if let number = value(statistics) {
                result[DayKey(statistics.startDate, calendar: calendar)] = number
            }
        }
        return result
    }

    private func nightlySleep(start: Date, end: Date, calendar: Calendar) async throws -> [DayKey: NightlySleep] {
        // Start reading the evening before the first day so that night's
        // sleep, which ends on the first day, is complete.
        let readStart = start.addingTimeInterval(-18 * 60 * 60)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(
                type: HKCategoryType(.sleepAnalysis),
                predicate: HKQuery.predicateForSamples(withStart: readStart, end: end)
            )],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        let samples = try await descriptor.result(for: store).compactMap { sample -> SleepSample? in
            guard let stage = Self.sleepStage(sample.value) else { return nil }
            return SleepSample(start: sample.startDate, end: sample.endDate, stage: stage)
        }
        let firstDay = DayKey(start, calendar: calendar)
        return SleepAggregator.nights(from: samples, calendar: calendar).filter { $0.key >= firstDay }
    }

    private static func sleepStage(_ value: Int) -> SleepStage? {
        switch HKCategoryValueSleepAnalysis(rawValue: value) {
        case .inBed: return .inBed
        case .awake: return .awake
        case .asleepUnspecified: return .asleepUnspecified
        case .asleepCore: return .core
        case .asleepDeep: return .deep
        case .asleepREM: return .rem
        default: return nil
        }
    }

    // MARK: - Workouts

    func workouts(from start: Date, to end: Date) async throws -> [HealthWorkoutRecord] {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForSamples(withStart: start, end: end))],
            sortDescriptors: [SortDescriptor(\.startDate, order: .reverse)]
        )
        return try await descriptor.result(for: store).map(Self.record)
    }

    private static func record(for workout: HKWorkout) -> HealthWorkoutRecord {
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let distance = distanceTypes.lazy
            .compactMap { workout.statistics(for: $0)?.sumQuantity()?.doubleValue(for: .meter()) }
            .first { $0 > 0 }
        let activity = WorkoutActivity(workout.workoutActivityType)

        return HealthWorkoutRecord(
            healthKitUUID: workout.uuid.uuidString,
            sourceBundleID: workout.sourceRevision.source.bundleIdentifier,
            rawActivityType: activity.key,
            displayName: activity.displayName,
            startedAt: workout.startDate,
            endedAt: workout.endDate,
            durationSeconds: Int(workout.duration.rounded()),
            activeCalories: workout.statistics(for: HKQuantityType(.activeEnergyBurned))?
                .sumQuantity()?.doubleValue(for: .kilocalorie()),
            distanceMeters: distance,
            averageHeartRate: workout.statistics(for: HKQuantityType(.heartRate))?
                .averageQuantity()?.doubleValue(for: bpm)
        )
    }
}

/// A stable key and human-readable name for a HealthKit activity type.
struct WorkoutActivity {
    let key: String
    let displayName: String

    init(_ type: HKWorkoutActivityType) {
        let known: (String, String)? = switch type {
        case .running: ("running", "Running")
        case .walking: ("walking", "Walking")
        case .hiking: ("hiking", "Hiking")
        case .cycling: ("cycling", "Cycling")
        case .swimming: ("swimming", "Swimming")
        case .rowing: ("rowing", "Rowing")
        case .elliptical: ("elliptical", "Elliptical")
        case .stairClimbing: ("stair_climbing", "Stair Climbing")
        case .mixedCardio: ("mixed_cardio", "Mixed Cardio")
        case .highIntensityIntervalTraining: ("hiit", "HIIT")
        case .traditionalStrengthTraining: ("traditional_strength_training", "Strength Training")
        case .functionalStrengthTraining: ("functional_strength_training", "Functional Strength")
        case .crossTraining: ("cross_training", "Cross Training")
        case .coreTraining: ("core_training", "Core Training")
        case .yoga: ("yoga", "Yoga")
        case .pilates: ("pilates", "Pilates")
        case .flexibility: ("flexibility", "Flexibility")
        case .cooldown: ("cooldown", "Cooldown")
        case .mindAndBody: ("mind_and_body", "Mind & Body")
        case .boxing: ("boxing", "Boxing")
        case .kickboxing: ("kickboxing", "Kickboxing")
        case .martialArts: ("martial_arts", "Martial Arts")
        case .climbing: ("climbing", "Climbing")
        case .basketball: ("basketball", "Basketball")
        case .soccer: ("soccer", "Soccer")
        case .tennis: ("tennis", "Tennis")
        case .pickleball: ("pickleball", "Pickleball")
        case .golf: ("golf", "Golf")
        case .cardioDance, .socialDance: ("dance", "Dance")
        default: nil
        }
        if let known {
            key = known.0
            displayName = known.1
        } else {
            key = "other_\(type.rawValue)"
            displayName = "Workout"
        }
    }
}
