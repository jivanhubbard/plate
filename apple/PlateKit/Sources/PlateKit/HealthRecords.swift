import Foundation

/// One row of `public.health_daily_metrics`: a day's health summary read from
/// Apple Health on the iPhone. Every value is optional because a user may not
/// grant every permission, and a day may have no samples of a given type.
public struct DailyHealthMetrics: Codable, Hashable, Sendable, Identifiable {
    public var userID: UUID?
    public var date: DayKey
    public var steps: Int?
    public var activeEnergyKcal: Double?
    public var restingHeartRate: Double?
    /// Daily mean of HealthKit's heart-rate-variability (SDNN) samples, in ms.
    public var hrvSDNNMilliseconds: Double?
    /// Minutes actually asleep (all sleep stages, not time in bed) for the
    /// sleep that ended on this day.
    public var sleepAsleepMinutes: Double?
    public var sleepStart: Date?
    public var sleepEnd: Date?
    public var weightKg: Double?
    public var bodyFatPercentage: Double?
    public var timeZone: String

    public var id: DayKey { date }

    public init(
        userID: UUID? = nil,
        date: DayKey,
        steps: Int? = nil,
        activeEnergyKcal: Double? = nil,
        restingHeartRate: Double? = nil,
        hrvSDNNMilliseconds: Double? = nil,
        sleepAsleepMinutes: Double? = nil,
        sleepStart: Date? = nil,
        sleepEnd: Date? = nil,
        weightKg: Double? = nil,
        bodyFatPercentage: Double? = nil,
        timeZone: String
    ) {
        self.userID = userID
        self.date = date
        self.steps = steps
        self.activeEnergyKcal = activeEnergyKcal
        self.restingHeartRate = restingHeartRate
        self.hrvSDNNMilliseconds = hrvSDNNMilliseconds
        self.sleepAsleepMinutes = sleepAsleepMinutes
        self.sleepStart = sleepStart
        self.sleepEnd = sleepEnd
        self.weightKg = weightKg
        self.bodyFatPercentage = bodyFatPercentage
        self.timeZone = timeZone
    }

    /// True when no metric has a value, so the row is not worth uploading.
    public var isEmpty: Bool {
        steps == nil && activeEnergyKcal == nil && restingHeartRate == nil
            && hrvSDNNMilliseconds == nil && sleepAsleepMinutes == nil
            && weightKg == nil && bodyFatPercentage == nil
    }

    enum CodingKeys: String, CodingKey {
        case date, steps
        case userID = "user_id"
        case activeEnergyKcal = "active_energy_kcal"
        case restingHeartRate = "resting_heart_rate"
        case hrvSDNNMilliseconds = "hrv_sdnn_ms"
        case sleepAsleepMinutes = "sleep_asleep_minutes"
        case sleepStart = "sleep_start"
        case sleepEnd = "sleep_end"
        case weightKg = "weight_kg"
        case bodyFatPercentage = "body_fat_percentage"
        case timeZone = "time_zone"
    }
}

/// The Health-sourced columns of `public.workouts`.
///
/// Deliberately excludes the user-edited columns (`session_tag_id`,
/// `perceived_exertion`, `notes`, `classified_at`) so that re-syncing a
/// workout never overwrites the user's own classification.
public struct HealthWorkoutRecord: Codable, Hashable, Sendable, Identifiable {
    public var userID: UUID?
    public var healthKitUUID: String
    public var sourceBundleID: String?
    public var rawActivityType: String
    public var displayName: String
    public var startedAt: Date
    public var endedAt: Date
    public var durationSeconds: Int
    public var activeCalories: Double?
    public var distanceMeters: Double?
    public var averageHeartRate: Double?

    public var id: String { healthKitUUID }

    public init(
        userID: UUID? = nil,
        healthKitUUID: String,
        sourceBundleID: String?,
        rawActivityType: String,
        displayName: String,
        startedAt: Date,
        endedAt: Date,
        durationSeconds: Int,
        activeCalories: Double?,
        distanceMeters: Double?,
        averageHeartRate: Double?
    ) {
        self.userID = userID
        self.healthKitUUID = healthKitUUID
        self.sourceBundleID = sourceBundleID
        self.rawActivityType = rawActivityType
        self.displayName = displayName
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.durationSeconds = durationSeconds
        self.activeCalories = activeCalories
        self.distanceMeters = distanceMeters
        self.averageHeartRate = averageHeartRate
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case healthKitUUID = "healthkit_uuid"
        case sourceBundleID = "source_bundle_id"
        case rawActivityType = "raw_activity_type"
        case displayName = "display_name"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case durationSeconds = "duration_seconds"
        case activeCalories = "active_calories"
        case distanceMeters = "distance_meters"
        case averageHeartRate = "average_heart_rate"
    }
}

/// One row of `public.health_sync_status`: when a device last pushed Health
/// data. Lets the Mac show how fresh the iPhone's data is.
public struct HealthSyncStatus: Codable, Hashable, Sendable {
    public var userID: UUID?
    public var deviceID: String
    public var deviceName: String
    public var lastSyncedAt: Date
    public var syncedFrom: DayKey?
    public var syncedThrough: DayKey?

    public init(
        userID: UUID? = nil,
        deviceID: String,
        deviceName: String,
        lastSyncedAt: Date,
        syncedFrom: DayKey?,
        syncedThrough: DayKey?
    ) {
        self.userID = userID
        self.deviceID = deviceID
        self.deviceName = deviceName
        self.lastSyncedAt = lastSyncedAt
        self.syncedFrom = syncedFrom
        self.syncedThrough = syncedThrough
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case deviceID = "device_id"
        case deviceName = "device_name"
        case lastSyncedAt = "last_synced_at"
        case syncedFrom = "synced_from"
        case syncedThrough = "synced_through"
    }
}

// MARK: - Explicit-null encoding
//
// PostgREST derives the column list of a multi-row upsert from the first row.
// Synthesized Codable omits nil optionals, which would make rows disagree on
// their keys and could silently drop columns. These encoders always write
// every column, using JSON null for missing values.

extension DailyHealthMetrics {
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(userID, forKey: .userID)
        try c.encode(date, forKey: .date)
        try c.encode(steps, forKey: .steps)
        try c.encode(activeEnergyKcal, forKey: .activeEnergyKcal)
        try c.encode(restingHeartRate, forKey: .restingHeartRate)
        try c.encode(hrvSDNNMilliseconds, forKey: .hrvSDNNMilliseconds)
        try c.encode(sleepAsleepMinutes, forKey: .sleepAsleepMinutes)
        try c.encode(sleepStart, forKey: .sleepStart)
        try c.encode(sleepEnd, forKey: .sleepEnd)
        try c.encode(weightKg, forKey: .weightKg)
        try c.encode(bodyFatPercentage, forKey: .bodyFatPercentage)
        try c.encode(timeZone, forKey: .timeZone)
    }
}

extension HealthWorkoutRecord {
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(userID, forKey: .userID)
        try c.encode(healthKitUUID, forKey: .healthKitUUID)
        try c.encode(sourceBundleID, forKey: .sourceBundleID)
        try c.encode(rawActivityType, forKey: .rawActivityType)
        try c.encode(displayName, forKey: .displayName)
        try c.encode(startedAt, forKey: .startedAt)
        try c.encode(endedAt, forKey: .endedAt)
        try c.encode(durationSeconds, forKey: .durationSeconds)
        try c.encode(activeCalories, forKey: .activeCalories)
        try c.encode(distanceMeters, forKey: .distanceMeters)
        try c.encode(averageHeartRate, forKey: .averageHeartRate)
    }
}
