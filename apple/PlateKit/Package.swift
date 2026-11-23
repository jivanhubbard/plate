// swift-tools-version: 5.10
import PackageDescription

// Platform-independent logic shared by the iOS and macOS apps.
// No HealthKit, UIKit, AppKit or Supabase imports belong here, so everything
// can be unit tested with `swift test` on the Mac.
let package = Package(
    name: "PlateKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PlateKit", targets: ["PlateKit"]),
    ],
    targets: [
        .target(name: "PlateKit"),
        .testTarget(name: "PlateKitTests", dependencies: ["PlateKit"]),
    ]
)
