# Plate iOS scaffold

This directory contains a local SwiftUI/XcodeGen scaffold. The generated Xcode project is intentionally not committed.

## Prerequisites

- macOS with **full Xcode 15 or newer** installed (Apple Command Line Tools alone are not enough)
- **XcodeGen** installed, for example with `brew install xcodegen`
- An Apple development team selected in Xcode for device signing and HealthKit entitlements
- A Supabase project URL and **anon/publishable client key**; never place a service-role key in this app

## Configure

From `plate-app/ios`:

```sh
cp Config.xcconfig.example Config.xcconfig
```

Edit `Config.xcconfig` and replace both placeholders. The local config file is gitignored. Its values are compiled into the app bundle, so they must be client-safe credentials protected by appropriate Supabase Row Level Security.

## Generate, open, and run

```sh
cd "/Users/heliumcore/Plate App/plate-app/ios"
xcodegen generate
open Plate.xcodeproj
```

In Xcode:

1. Wait for the Supabase Swift package to resolve.
2. Select the `Plate` target and choose your development team under Signing & Capabilities.
3. Confirm the HealthKit capability is present.
4. Choose an iOS 17+ simulator or connected device and press Run.

## HealthKit caveat

HealthKit behavior and available sample data differ in Simulator, and some workflows require a signed build on a physical iPhone. Test workout authorization and real workout import on a device. Authorization may succeed while no readable workouts are returned, including when the user denies access.

## Current scope

- Supabase email/password sign-in boundary
- Fast branded-food search through the shared `search_branded_foods` RPC
- Placeholder dashboard
- Recent HealthKit workout authorization, import, suggested classification, and editable classification
- Local notification authorization/scheduling service boundary
- On-device Vision OCR for Nutrition Facts labels, followed by an editable macro form and explicit user confirmation
- A protocol boundary for future food-photo estimation and an honest unconfigured-endpoint placeholder

This scaffold does not persist nutrition drafts or workout classifications, upload photos, configure a remote vision service, or perform generic local meal-photo macro inference.
