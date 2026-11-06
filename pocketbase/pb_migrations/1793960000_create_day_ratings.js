/// <reference path="../pb_data/types.d.ts" />

// How each day went, graded 1-5 in a few areas from the Idag page. One record
// per user and date. Only the owner can see or change them.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")
    const grade = (name, required) => ({
      type: "number",
      name,
      required,
      onlyInt: true,
      min: 1,
      max: 5,
    })

    const ratings = new Collection({
      type: "base",
      name: "day_ratings",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule:
        "user = @request.auth.id && @request.body.user:isset = false",
      deleteRule: "user = @request.auth.id",
      fields: [
        // "2026-11-06". Text rather than a date so there are no time zone
        // shifts.
        {
          type: "text",
          name: "date",
          required: true,
          pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
        },
        // Whether work was graded that day. When false, `work` is empty.
        { type: "bool", name: "worked" },
        // Empty (0) on days without work. PocketBase treats 0 as unset, so
        // the 1-5 range only applies when a grade is given.
        { ...grade("work", false), min: null },
        grade("exercise", true),
        grade("food", true),
        grade("social", true),
        grade("creativity", true),
        grade("general", true),
        { type: "text", name: "comment", max: 2000 },
        {
          type: "relation",
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_day_ratings_user_date ON day_ratings (user, date)",
      ],
    })
    app.save(ratings)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("day_ratings"))
  },
)
