/// <reference path="../pb_data/types.d.ts" />

// A mirror of the inbox for the "Mejl" page and the Post panel. The service
// keeps it in sync with Gmail and is the only thing that writes to it, using a
// separate PocketBase user (service@life-app.local) that you create by hand.
// Signed-in users can read it but not change it. Only a short snippet is
// stored, never the full message, and none at all for sensitive mail.
migrate(
  (app) => {
    const serviceOnly = '@request.auth.email = "service@life-app.local"'

    const mails = new Collection({
      type: "base",
      name: "mails",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: serviceOnly,
      updateRule: serviceOnly,
      deleteRule: serviceOnly,
      fields: [
        { type: "number", name: "uid", required: true },
        { type: "number", name: "uidValidity", required: true },
        { type: "text", name: "messageId", max: 500 },
        { type: "text", name: "threadId", max: 40 },
        { type: "text", name: "fromAddress", max: 320 },
        { type: "text", name: "fromName", max: 300 },
        { type: "text", name: "subject", max: 1000 },
        { type: "date", name: "date" },
        { type: "text", name: "snippet", max: 600 },
        {
          type: "select",
          name: "bucket",
          required: true,
          maxSelect: 1,
          values: [
            "important",
            "invoices",
            "deliveries",
            "bookings",
            "newsletters",
            "promotions",
            "other",
          ],
        },
        { type: "bool", name: "seen" },
        { type: "bool", name: "sensitive" },
        { type: "bool", name: "bulk" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_mails_uid ON mails (uidValidity, uid)",
        "CREATE INDEX idx_mails_bucket_date ON mails (bucket, date)",
      ],
    })
    app.save(mails)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("mails"))
  },
)
