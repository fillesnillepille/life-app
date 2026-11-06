/// <reference path="../pb_data/types.d.ts" />

// The Schema page: shift types, the repeating 5-week shift cycle, one-day
// changes to it, and schedule entries, which can point to a to-do item.
// Everything belongs to one user, and only that user can see or change it.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")
    const todos = app.findCollectionByNameOrId("todos")

    const ownerRules = {
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule:
        "user = @request.auth.id && @request.body.user:isset = false",
      deleteRule: "user = @request.auth.id",
    }
    const userField = {
      type: "relation",
      name: "user",
      required: true,
      maxSelect: 1,
      collectionId: users.id,
      cascadeDelete: true,
    }
    const timestamps = [
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ]
    // "07:30". Text rather than a date, since a time of day has no date or
    // time zone.
    const timePattern = "^([01]\\d|2[0-3]):[0-5]\\d$"
    // "2026-11-06", for the same reason.
    const datePattern = "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$"

    // A kind of shift, such as "Dag 07:00-16:00". An end before the start
    // means the shift runs past midnight.
    const shiftTypes = new Collection({
      type: "base",
      name: "shift_types",
      ...ownerRules,
      fields: [
        { type: "text", name: "name", required: true, max: 40 },
        { type: "text", name: "start", required: true, pattern: timePattern },
        { type: "text", name: "end", required: true, pattern: timePattern },
        {
          type: "select",
          name: "color",
          required: true,
          maxSelect: 1,
          values: ["blue", "violet", "amber", "cyan", "pink", "gray"],
        },
        userField,
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_shift_types_user ON shift_types (user)"],
    })
    app.save(shiftTypes)

    // The repeating cycle, one per user. `startDate` is the Monday of week 1,
    // and `days` lists 35 shift type ids, an empty string meaning a day off.
    const cycles = new Collection({
      type: "base",
      name: "shift_cycles",
      ...ownerRules,
      fields: [
        { type: "text", name: "startDate", required: true, pattern: datePattern },
        { type: "json", name: "days", maxSize: 4000 },
        userField,
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_shift_cycles_user ON shift_cycles (user)",
      ],
    })
    app.save(cycles)

    // A change to one date, which wins over the cycle: another shift, or a
    // day off, vacation, or sick day.
    const overrides = new Collection({
      type: "base",
      name: "shift_overrides",
      ...ownerRules,
      fields: [
        { type: "text", name: "date", required: true, pattern: datePattern },
        {
          type: "select",
          name: "kind",
          required: true,
          maxSelect: 1,
          values: ["shift", "off", "vacation", "sick"],
        },
        // Set when kind is "shift". Deleting the shift type removes the
        // overrides that use it, and the cycle applies again.
        {
          type: "relation",
          name: "shiftType",
          maxSelect: 1,
          collectionId: shiftTypes.id,
          cascadeDelete: true,
        },
        userField,
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_shift_overrides_user_date ON shift_overrides (user, date)",
      ],
    })
    app.save(overrides)

    // Something planned for a date, all day or at a time. It can point to a
    // to-do item, whose done state it then shares. The title is kept too, so
    // the entry survives the item being deleted.
    const entries = new Collection({
      type: "base",
      name: "schedule_entries",
      ...ownerRules,
      fields: [
        { type: "text", name: "title", required: true, max: 200 },
        { type: "text", name: "date", required: true, pattern: datePattern },
        { type: "bool", name: "allDay" },
        { type: "text", name: "start", pattern: timePattern },
        { type: "text", name: "end", pattern: timePattern },
        {
          type: "relation",
          name: "todo",
          maxSelect: 1,
          collectionId: todos.id,
          cascadeDelete: false,
        },
        // Used only when the entry has no to-do item.
        { type: "bool", name: "done" },
        userField,
        ...timestamps,
      ],
      indexes: [
        "CREATE INDEX idx_schedule_entries_user_date ON schedule_entries (user, date)",
        "CREATE INDEX idx_schedule_entries_todo ON schedule_entries (todo)",
      ],
    })
    app.save(entries)
  },
  (app) => {
    for (const name of [
      "schedule_entries",
      "shift_overrides",
      "shift_cycles",
      "shift_types",
    ]) {
      app.delete(app.findCollectionByNameOrId(name))
    }
  },
)
