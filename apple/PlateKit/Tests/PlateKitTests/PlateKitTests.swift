import Foundation
import XCTest
@testable import PlateKit

private let pacific: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
    return calendar
}()

/// A date in America/Los_Angeles.
private func pt(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int = 0) -> Date {
    pacific.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
}

final class DayKeyTests: XCTestCase {
    func testUsesCalendarTimeZoneNotUTC() {
        // 11pm Pacific on the 22nd is already the 23rd in UTC.
        XCTAssertEqual(DayKey(pt(2026, 11, 22, 23), calendar: pacific).description, "2026-11-22")
    }

    func testStringRoundTripAndOrdering() {
        let key = DayKey(string: "2026-03-09")!
        XCTAssertEqual(key.description, "2026-03-09")
        XCTAssertLessThan(key, DayKey(string: "2026-03-10")!)
        XCTAssertNil(DayKey(string: "not-a-date"))
    }

    func testAddingDaysAcrossDSTAndMonthEnd() {
        // US DST starts 2026-03-08.
        XCTAssertEqual(DayKey(string: "2026-03-07")!.adding(days: 2, calendar: pacific).description, "2026-03-09")
        XCTAssertEqual(DayKey(string: "2026-02-28")!.adding(days: 1, calendar: pacific).description, "2026-03-01")
    }
}

final class SleepAggregatorTests: XCTestCase {
    func testOvernightSleepBelongsToWakeDay() {
        let samples = [
            SleepSample(start: pt(2026, 11, 22, 22, 30), end: pt(2026, 11, 23, 2), stage: .core),
            SleepSample(start: pt(2026, 11, 23, 2), end: pt(2026, 11, 23, 3), stage: .deep),
            SleepSample(start: pt(2026, 11, 23, 3), end: pt(2026, 11, 23, 3, 20), stage: .awake),
            SleepSample(start: pt(2026, 11, 23, 3, 20), end: pt(2026, 11, 23, 6, 30), stage: .rem),
        ]
        let nights = SleepAggregator.nights(from: samples, calendar: pacific)
        let night = nights[DayKey(string: "2026-11-23")!]!

        XCTAssertEqual(nights.count, 1)
        // 8h total in the window minus 20 min awake.
        XCTAssertEqual(night.asleepMinutes, 460, accuracy: 0.001)
        XCTAssertEqual(night.mainSleepStart, pt(2026, 11, 22, 22, 30))
        XCTAssertEqual(night.mainSleepEnd, pt(2026, 11, 23, 6, 30))
    }

    func testOverlappingSourcesAreNotDoubleCounted() {
        // Watch and a phone app record the same night.
        let samples = [
            SleepSample(start: pt(2026, 11, 22, 23), end: pt(2026, 11, 23, 7), stage: .asleepUnspecified),
            SleepSample(start: pt(2026, 11, 22, 23, 30), end: pt(2026, 11, 23, 6), stage: .core),
        ]
        let night = SleepAggregator.nights(from: samples, calendar: pacific)[DayKey(string: "2026-11-23")!]!
        XCTAssertEqual(night.asleepMinutes, 480, accuracy: 0.001)
    }

    func testInBedAndAwakeAreIgnored() {
        let samples = [
            SleepSample(start: pt(2026, 11, 22, 22), end: pt(2026, 11, 23, 7), stage: .inBed),
            SleepSample(start: pt(2026, 11, 23, 1), end: pt(2026, 11, 23, 2), stage: .awake),
        ]
        XCTAssertTrue(SleepAggregator.nights(from: samples, calendar: pacific).isEmpty)
    }

    func testNapCountsTowardTotalButNotMainSleepWindow() {
        let samples = [
            SleepSample(start: pt(2026, 11, 22, 23), end: pt(2026, 11, 23, 6), stage: .core),
            SleepSample(start: pt(2026, 11, 23, 14), end: pt(2026, 11, 23, 14, 30), stage: .core),
        ]
        let night = SleepAggregator.nights(from: samples, calendar: pacific)[DayKey(string: "2026-11-23")!]!
        XCTAssertEqual(night.asleepMinutes, 450, accuracy: 0.001)
        XCTAssertEqual(night.mainSleepEnd, pt(2026, 11, 23, 6))
    }

    func testSeparateNightsLandOnSeparateDays() {
        let samples = [
            SleepSample(start: pt(2026, 11, 21, 23), end: pt(2026, 11, 22, 6), stage: .core),
            SleepSample(start: pt(2026, 11, 22, 23), end: pt(2026, 11, 23, 7), stage: .core),
        ]
        let nights = SleepAggregator.nights(from: samples, calendar: pacific)
        XCTAssertEqual(nights[DayKey(string: "2026-11-22")!]?.asleepMinutes ?? 0, 420, accuracy: 0.001)
        XCTAssertEqual(nights[DayKey(string: "2026-11-23")!]?.asleepMinutes ?? 0, 480, accuracy: 0.001)
    }
}

final class HealthSyncWindowTests: XCTestCase {
    let now = pt(2026, 11, 23, 9)

    func testFirstSyncBackfills() {
        let range = HealthSyncWindow.days(lastSuccessfulSync: nil, now: now, calendar: pacific, initialBackfillDays: 90)
        XCTAssertEqual(range.upperBound.description, "2026-11-23")
        XCTAssertEqual(HealthSyncWindow.allDays(in: range, calendar: pacific).count, 90)
    }

    func testLaterSyncRereadsOverlap() {
        let range = HealthSyncWindow.days(lastSuccessfulSync: pt(2026, 11, 22, 21), now: now, calendar: pacific, overlapDays: 2)
        XCTAssertEqual(range.lowerBound.description, "2026-11-20")
        XCTAssertEqual(range.upperBound.description, "2026-11-23")
    }

    func testLongGapIsCappedAtBackfill() {
        let range = HealthSyncWindow.days(lastSuccessfulSync: pt(2025, 1, 1, 9), now: now, calendar: pacific, initialBackfillDays: 30)
        XCTAssertEqual(HealthSyncWindow.allDays(in: range, calendar: pacific).count, 30)
    }

    func testFutureLastSyncDoesNotProduceEmptyRange() {
        // Clock skew: last sync appears to be tomorrow.
        let range = HealthSyncWindow.days(lastSuccessfulSync: pt(2026, 11, 24, 9), now: now, calendar: pacific, overlapDays: 2)
        XCTAssertEqual(range.lowerBound.description, "2026-11-21")
        XCTAssertEqual(range.upperBound.description, "2026-11-23")
    }
}

final class EncodingTests: XCTestCase {
    func testDailyMetricsEncodeEveryColumnIncludingNulls() throws {
        let metrics = DailyHealthMetrics(date: DayKey(string: "2026-11-23")!, steps: 8000, timeZone: "America/Los_Angeles")
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(metrics)) as! [String: Any]

        XCTAssertEqual(object.count, 12)
        XCTAssertEqual(object["date"] as? String, "2026-11-23")
        XCTAssertEqual(object["steps"] as? Int, 8000)
        XCTAssertTrue(object["hrv_sdnn_ms"] is NSNull)
        XCTAssertTrue(object["sleep_start"] is NSNull)
    }

    func testWorkoutEncodingOmitsUserEditedColumns() throws {
        let workout = HealthWorkoutRecord(
            healthKitUUID: "ABC", sourceBundleID: nil, rawActivityType: "running", displayName: "Running",
            startedAt: pt(2026, 11, 23, 7), endedAt: pt(2026, 11, 23, 8), durationSeconds: 3600,
            activeCalories: 500, distanceMeters: nil, averageHeartRate: nil
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(workout)) as! [String: Any]

        XCTAssertEqual(object.count, 11)
        XCTAssertTrue(object["distance_meters"] is NSNull)
        for userColumn in ["session_tag_id", "perceived_exertion", "notes", "classified_at"] {
            XCTAssertNil(object[userColumn])
        }
    }

    func testDailyMetricsDecodeFromSupabaseRow() throws {
        let json = #"{"user_id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","date":"2026-11-23","steps":null,"active_energy_kcal":412.5,"resting_heart_rate":null,"hrv_sdnn_ms":48,"sleep_asleep_minutes":null,"sleep_start":null,"sleep_end":null,"weight_kg":null,"body_fat_percentage":null,"time_zone":"America/Los_Angeles","created_at":"x"}"#
        let metrics = try JSONDecoder().decode(DailyHealthMetrics.self, from: Data(json.utf8))
        XCTAssertEqual(metrics.date.description, "2026-11-23")
        XCTAssertEqual(metrics.hrvSDNNMilliseconds, 48)
        XCTAssertNil(metrics.steps)
    }
}

final class JSONFileCacheTests: XCTestCase {
    func testRoundTrip() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID()).json")
        let cache = JSONFileCache<[DailyHealthMetrics]>(url: url)
        defer { cache.clear() }

        XCTAssertNil(cache.load())
        let value = [DailyHealthMetrics(date: DayKey(string: "2026-11-23")!, sleepEnd: pt(2026, 11, 23, 6), timeZone: "UTC")]
        try cache.save(value)
        XCTAssertEqual(cache.load(), value)
    }
}
