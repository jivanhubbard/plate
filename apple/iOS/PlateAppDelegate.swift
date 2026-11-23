import UIKit

final class PlateAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // HealthKit background delivery only works if observer queries are
        // registered during launch, including launches HealthKit triggers
        // in the background when new data arrives.
        AppEnvironment.shared.healthSync.startBackgroundObservers()
        return true
    }
}
