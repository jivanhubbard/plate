import SwiftUI

/// iPhone Health tab: connect to Apple Health, sync, and see synced data.
struct HealthSyncView: View {
    @EnvironmentObject private var supabase: SupabaseService
    @ObservedObject var dashboard: HealthDashboardModel
    @ObservedObject private var sync = AppEnvironment.shared.healthSync
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        HealthDashboardView(model: dashboard) {
            syncControls
        }
        .task {
            await sync.refreshAuthorizationState()
            await syncAndReload(.foreground)
        }
        .onChange(of: scenePhase) {
            guard scenePhase == .active else { return }
            Task { await syncAndReload(.foreground) }
        }
    }

    @ViewBuilder
    private var syncControls: some View {
        if !sync.isHealthAvailable {
            Label("Apple Health is not available on this device.", systemImage: "heart.slash")
        } else if sync.needsAuthorization {
            VStack(alignment: .leading, spacing: 8) {
                Text("Connect Apple Health")
                    .font(.headline)
                Text("Plate reads sleep, heart rate variability, resting heart rate, steps, active energy, weight, body fat and workouts. It never writes to Health.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Connect Apple Health") {
                    Task {
                        await sync.connect()
                        await dashboard.refresh(using: supabase)
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.vertical, 4)
        } else {
            Button {
                Task { await syncAndReload(.manual) }
            } label: {
                if sync.isSyncing {
                    HStack {
                        ProgressView()
                        Text("Syncing with Health…")
                    }
                } else {
                    Label("Sync with Health", systemImage: "arrow.triangle.2.circlepath")
                }
            }
            .disabled(sync.isSyncing)

            if let result = sync.lastResult {
                Text("Synced \(result.days) days and \(result.workouts) workouts \(result.finishedAt.formatted(.relative(presentation: .named))).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }

        if let error = sync.lastError {
            Label(error, systemImage: "exclamationmark.triangle")
                .font(.footnote)
                .foregroundStyle(.orange)
        }
    }

    private func syncAndReload(_ trigger: HealthSyncCoordinator.Trigger) async {
        guard !sync.needsAuthorization else { return }
        await sync.sync(trigger: trigger)
        await dashboard.refresh(using: supabase)
    }
}
