# Plate for iPhone and Mac

One SwiftUI codebase, two apps, synced through Supabase:

- **iPhone (`Plate-iOS`)** reads Apple Health (sleep, HRV, resting heart rate,
  steps, active energy, weight, body fat, workouts) and uploads daily
  summaries to Supabase, including in the background.
- **Mac (`Plate-macOS`)** is the main dashboard. Macs have no Apple Health
  store, so it reads the synced data from Supabase.

## Layout

```
apple/
├── PlateKit/   Pure Swift package: models, sleep aggregation, sync windows,
│               offline cache. No Apple-framework or Supabase imports.
├── Shared/     Code compiled into both apps (auth, Supabase, dashboard,
│               food search, Nutrition Facts label scanning).
├── iOS/        iPhone-only: HealthKit reading, background delivery, sync UI.
├── macOS/      Mac Info.plist and sandbox entitlements.
└── project.yml XcodeGen definition. Plate.xcodeproj is generated, not committed.
```

## Prerequisites

- Xcode 15 or newer (built and tested with Xcode 27.2)
- XcodeGen: `brew install xcodegen`
- A Supabase project URL and **anon/publishable** key. Never put a
  service-role key in the app.

## Database

Run these in the Supabase SQL editor, in order, if not already applied:

1. `supabase/migrations/add_workouts_and_insights.sql`
2. `supabase/migrations/add_health_sync.sql`

Then reload the API schema (Settings → API → Reload schema).

## Configure, generate and run

```sh
cd apple
cp Config.xcconfig.example Config.xcconfig   # then fill in both values
xcodegen generate
open Plate.xcodeproj
```

- **Mac:** choose the `Plate-macOS` scheme and run.
- **iPhone:** choose `Plate-iOS`, select your team under Signing &
  Capabilities, and run on a physical iPhone. The Simulator has little or no
  Health data, and background delivery only works on a device.

## Tests

```sh
cd apple/PlateKit && swift test
```

## How sync works

- Apple Health is the source of truth, and every upload is an idempotent
  upsert (`health_daily_metrics` keyed on user + date, `workouts` keyed on
  user + HealthKit UUID). Re-reading a day is always safe.
- Each sync re-reads from two days before the last successful sync through
  today (90 days on the first sync), so late-arriving Watch data is caught.
  A failed upload doesn't advance the last-sync date, so the next sync
  covers it. No upload queue is needed.
- Syncs run on tap, when the app comes to the foreground (at most every
  2 minutes), and when HealthKit wakes the app for new workouts, sleep,
  HRV, resting heart rate or weight (at most every 5 minutes).
- Re-syncing a workout only updates its Health columns; anything you set
  yourself (type, effort, notes) is never overwritten.
- Sleep is attributed to the day you wake up. Overlapping sources (e.g.
  Watch plus a sleep app) are merged so time isn't counted twice; naps count
  toward that day's total.

## Known limitations

- Workouts or samples deleted from Apple Health are not yet deleted from
  Supabase.
- HRV is the daily average of all HealthKit SDNN readings, not overnight
  only. Phase 4 (recovery) may refine this.
