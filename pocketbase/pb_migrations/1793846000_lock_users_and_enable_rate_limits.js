/// <reference path="../pb_data/types.d.ts" />

// This app has a single user, created by hand in the PocketBase dashboard.
// Close public sign-up and self-deletion, and rate-limit login attempts.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")
    users.createRule = null
    users.deleteRule = null
    app.save(users)

    const settings = app.settings()
    settings.rateLimits.enabled = true
    app.save(settings)
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users")
    users.createRule = ""
    users.deleteRule = "id = @request.auth.id"
    app.save(users)

    const settings = app.settings()
    settings.rateLimits.enabled = false
    app.save(settings)
  },
)
