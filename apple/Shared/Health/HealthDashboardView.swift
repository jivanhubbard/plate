import PlateKit
import SwiftUI

/// Recent synced health data: latest values, a day-by-day history and recent
/// workouts. Shown on both iPhone and Mac.
struct HealthDashboardView<Header: View>: View {
    @EnvironmentObject private var supabase: SupabaseService
    @ObservedObject var model: HealthDashboardModel
    let header: Header

    init(model: HealthDashboardModel, @ViewBuilder header: () -> Header) {
        self.model = model
        self.header = header()
    }

    var body: some View {
        List {
            if Header.self != EmptyView.self {
                Section { header }
            }

            if let errorMessage = model.errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }

            Section {
                freshnessRow
            }

            if model.metrics.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No health data yet",
                        systemImage: "heart.text.square",
                        description: Text(Self.emptyMessage)
                    )
                }
            } else {
                Section("Latest") {
                    summaryGrid
                }
                Section("Daily history") {
                    ForEach(model.metrics) { day in
                        DayRow(day: day)
                    }
                }
            }

            if !model.workouts.isEmpty {
                Section("Workouts from Health") {
                    ForEach(model.workouts) { workout in
                        WorkoutRow(workout: workout)
                    }
                }
            }
        }
        .refreshable { await model.refresh(using: supabase) }
        .task { await model.refresh(using: supabase) }
    }

    private static var emptyMessage: String {
        #if os(iOS)
        "Tap Sync with Health to bring in your sleep, heart, activity and workout data."
        #else
        "Open Plate on your iPhone and sync with Apple Health. The data will appear here."
        #endif
    }

    @ViewBuilder
    private var freshnessRow: some View {
        if let sync = model.latestSync {
            LabeledContent("Last synced from \(sync.deviceName)") {
                Text(sync.lastSyncedAt, format: .relative(presentation: .named))
            }
        } else {
            LabeledContent("Health sync", value: "Never")
        }
        if model.isLoading {
            ProgressView().frame(maxWidth: .infinity)
        }
    }

    private var summaryGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), alignment: .leading)], alignment: .leading, spacing: 16) {
            SummaryTile(
                title: "Sleep",
                systemImage: "bed.double",
                value: model.latest(\.sleepAsleepMinutes).map { Format.sleep($0.value) },
                comparison: model.average(\.sleepAsleepMinutes).map { "7-day avg \(Format.sleep($0))" }
            )
            SummaryTile(
                title: "HRV",
                systemImage: "waveform.path.ecg",
                value: model.latest(\.hrvSDNNMilliseconds).map { "\(Format.whole($0.value)) ms" },
                comparison: model.average(\.hrvSDNNMilliseconds).map { "7-day avg \(Format.whole($0)) ms" }
            )
            SummaryTile(
                title: "Resting HR",
                systemImage: "heart",
                value: model.latest(\.restingHeartRate).map { "\(Format.whole($0.value)) bpm" },
                comparison: model.average(\.restingHeartRate).map { "7-day avg \(Format.whole($0)) bpm" }
            )
            SummaryTile(
                title: "Steps",
                systemImage: "figure.walk",
                value: model.latest(\.steps).map { $0.value.formatted() },
                comparison: nil
            )
            SummaryTile(
                title: "Weight",
                systemImage: "scalemass",
                value: model.latest(\.weightKg).map { Format.weight($0.value) },
                comparison: nil
            )
        }
        .padding(.vertical, 4)
    }
}

private struct SummaryTile: View {
    let title: String
    let systemImage: String
    let value: String?
    let comparison: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value ?? "—")
                .font(.title3.weight(.semibold))
                .monospacedDigit()
            if let comparison {
                Text(comparison)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct DayRow: View {
    let day: DailyHealthMetrics

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(day.date.startDate(in: .current), format: .dateTime.weekday(.wide).month().day())
                .font(.subheadline.weight(.medium))
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) { values }
                VStack(alignment: .leading, spacing: 2) { values }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .monospacedDigit()
        }
    }

    @ViewBuilder
    private var values: some View {
        if let sleep = day.sleepAsleepMinutes { Text("Sleep \(Format.sleep(sleep))") }
        if let hrv = day.hrvSDNNMilliseconds { Text("HRV \(Format.whole(hrv)) ms") }
        if let rhr = day.restingHeartRate { Text("RHR \(Format.whole(rhr)) bpm") }
        if let steps = day.steps { Text("\(steps.formatted()) steps") }
        if let energy = day.activeEnergyKcal { Text("\(Format.whole(energy)) active kcal") }
        if let weight = day.weightKg { Text(Format.weight(weight)) }
    }
}

private struct WorkoutRow: View {
    let workout: HealthWorkoutRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workout.displayName)
                .font(.subheadline.weight(.medium))
            HStack(spacing: 12) {
                Text(workout.startedAt, format: .dateTime.weekday().month().day().hour().minute())
                Text(Duration.seconds(workout.durationSeconds).formatted(.units(allowed: [.hours, .minutes], width: .narrow)))
                if let calories = workout.activeCalories { Text("\(Format.whole(calories)) kcal") }
                if let heartRate = workout.averageHeartRate { Text("avg \(Format.whole(heartRate)) bpm") }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .monospacedDigit()
        }
    }
}

enum Format {
    static func whole(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0)))
    }

    static func sleep(_ minutes: Double) -> String {
        Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .narrow))
    }

    /// Kilograms shown in the user's locale (pounds in the US).
    static func weight(_ kilograms: Double) -> String {
        Measurement(value: kilograms, unit: UnitMass.kilograms)
            .formatted(.measurement(width: .abbreviated, usage: .personWeight, numberFormatStyle: .number.precision(.fractionLength(1))))
    }
}

extension HealthDashboardView where Header == EmptyView {
    init(model: HealthDashboardModel) {
        self.init(model: model) { EmptyView() }
    }
}
