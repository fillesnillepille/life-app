/// <reference path="../pb_data/types.d.ts" />

// Adds the shopping list ("Inköp") to the to-do lists.
migrate(
  (app) => {
    const todos = app.findCollectionByNameOrId("todos")
    todos.fields.getByName("list").values = [
      "daily",
      "longterm",
      "bucket",
      "shopping",
    ]
    app.save(todos)
  },
  (app) => {
    const todos = app.findCollectionByNameOrId("todos")
    todos.fields.getByName("list").values = ["daily", "longterm", "bucket"]
    app.save(todos)
  },
)
