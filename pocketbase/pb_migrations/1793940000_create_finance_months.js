/// <reference path="../pb_data/types.d.ts" />

// Monthly money figures for the Ekonomi page, typed in by hand once a month.
// One record per user and month. Only the owner can see or change them.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")

    const months = new Collection({
      type: "base",
      name: "finance_months",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule:
        "user = @request.auth.id && @request.body.user:isset = false",
      deleteRule: "user = @request.auth.id",
      fields: [
        // "2026-11". Text rather than a date so there are no time zone shifts.
        {
          type: "text",
          name: "month",
          required: true,
          pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
        },
        // What was spent during the month.
        { type: "number", name: "expenses", min: 0 },
        // Money in savings accounts at the end of the month.
        { type: "number", name: "savings", min: 0 },
        // The market value of investments at the end of the month.
        { type: "number", name: "investments", min: 0 },
        // Money put into investments during the month, minus withdrawals.
        // Optional, and lets the page tell returns apart from deposits.
        { type: "number", name: "deposited" },
        { type: "text", name: "note", max: 500 },
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
        "CREATE UNIQUE INDEX idx_finance_months_user_month ON finance_months (user, month)",
      ],
    })
    app.save(months)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("finance_months"))
  },
)
