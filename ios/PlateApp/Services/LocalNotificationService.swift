import Foundation
import UserNotifications

struct LocalNotificationService {
    private let center = UNUserNotificationCenter.current()

    func requestAuthorization() async throws -> Bool {
        try await center.requestAuthorization(options: [.alert, .badge, .sound])
    }

    func scheduleMealReminder(at date: Date) async throws {
        let content = UNMutableNotificationContent()
        content.title = "Meal check-in"
        content.body = "Open Plate when you are ready to log your meal."
        content.sound = .default

        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(
            identifier: "daily-meal-reminder",
            content: content,
            trigger: trigger
        )
        try await center.add(request)
    }
}
