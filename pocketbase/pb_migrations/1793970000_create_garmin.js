/// <reference path="../pb_data/types.d.ts" />

// Training and health data from Garmin Connect, for Hälsa, Schema, and Idag.
// The service reads it from Garmin's Personal API and is the only thing that
// writes it, as its own PocketBase user (service@life-app.local), the same as
// mail. Signed-in users can read it but not change it.
//
// Numbers Garmin didn't report are stored as 0, since PocketBase treats 0 as
// unset. The app shows them as missing.
migrate(
  (app) => {
    const serviceOnly = '@request.auth.email = "service@life-app.local"'
    const rules = {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: serviceOnly,
      updateRule: serviceOnly,
      deleteRule: serviceOnly,
    }
    // "2026-11-06" in local time. Text rather than a date so there are no
    // time zone shifts.
    const dateField = {
      type: "text",
      name: "date",
      required: true,
      pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
    }
    // "07:30" in local time, or empty.
    const clock = (name) => ({
      type: "text",
      name,
      pattern: "^(([01]\\d|2[0-3]):[0-5]\\d)?$",
    })
    const number = (name) => ({ type: "number", name })
    const timestamps = [
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ]

    // One record per activity. Only the summary: no GPS route and no
    // second-by-second data.
    const activities = new Collection({
      type: "base",
      name: "garmin_activities",
      ...rules,
      fields: [
        { type: "number", name: "garminId", required: true, onlyInt: true },
        { type: "text", name: "name", max: 500 },
        // Garmin's type key, such as "running" or "strength_training".
        { type: "text", name: "type", max: 100 },
        dateField,
        clock("startTime"),
        // The start in UTC, for sorting and for exact times.
        { type: "date", name: "startedAt" },
        // Seconds: on the timer, from start to finish, and while moving.
        number("duration"),
        number("elapsed"),
        number("moving"),
        // Metres.
        number("distance"),
        number("elevationGain"),
        number("averageHr"),
        number("maxHr"),
        number("calories"),
        // Metres per second.
        number("averageSpeed"),
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_garmin_activities_id ON garmin_activities (garminId)",
        "CREATE INDEX idx_garmin_activities_date ON garmin_activities (date)",
      ],
    })
    app.save(activities)

    // One record per day: the night's sleep (the night that ends on this
    // date), HRV, and the day's summary.
    const days = new Collection({
      type: "base",
      name: "garmin_days",
      ...rules,
      fields: [
        dateField,
        // Seconds asleep, excluding naps, and per stage.
        number("sleep"),
        number("deepSleep"),
        number("lightSleep"),
        number("remSleep"),
        number("awake"),
        // 0-100
        number("sleepScore"),
        clock("sleepStart"),
        clock("sleepEnd"),
        // Milliseconds, the night's average and the 7-day average.
        number("hrvLastNight"),
        number("hrvWeekly"),
        // Garmin's status, such as "BALANCED" or "LOW".
        { type: "text", name: "hrvStatus", max: 40 },
        number("restingHr"),
        number("steps"),
        number("stepsGoal"),
        // Garmin's stress level, 0-100.
        number("stress"),
        number("bodyBatteryHigh"),
        number("bodyBatteryLow"),
        number("activeCalories"),
        number("moderateMinutes"),
        number("vigorousMinutes"),
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_garmin_days_date ON garmin_days (date)",
      ],
    })
    app.save(days)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("garmin_days"))
    app.delete(app.findCollectionByNameOrId("garmin_activities"))
  },
)
