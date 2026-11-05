/// <reference path="../pb_data/types.d.ts" />

// Adds the "codes" bucket (login codes and password resets) to mail.
migrate(
  (app) => {
    const mails = app.findCollectionByNameOrId("mails")
    mails.fields.getByName("bucket").values = [
      "important",
      "invoices",
      "deliveries",
      "bookings",
      "newsletters",
      "promotions",
      "codes",
      "other",
    ]
    app.save(mails)
  },
  (app) => {
    // Mail in the removed bucket would no longer be valid, so move it first.
    const stranded = app.findRecordsByFilter("mails", 'bucket = "codes"', "", 0, 0)
    for (const record of stranded) {
      record.set("bucket", "other")
      app.save(record)
    }
    const mails = app.findCollectionByNameOrId("mails")
    mails.fields.getByName("bucket").values = [
      "important",
      "invoices",
      "deliveries",
      "bookings",
      "newsletters",
      "promotions",
      "other",
    ]
    app.save(mails)
  },
)
