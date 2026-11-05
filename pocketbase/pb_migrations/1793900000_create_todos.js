/// <reference path="../pb_data/types.d.ts" />

// To-do items for the "Att göra" page. One collection holds three lists:
// daily, long-term, and the bucket list. Each item belongs to one user, and
// only that user can see or change it.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")

    const todos = new Collection({
      type: "base",
      name: "todos",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule:
        "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule:
        "user = @request.auth.id && @request.body.user:isset = false",
      deleteRule: "user = @request.auth.id",
      fields: [
        { type: "text", name: "title", required: true, max: 200 },
        {
          type: "select",
          name: "list",
          required: true,
          maxSelect: 1,
          values: ["daily", "longterm", "bucket"],
        },
        { type: "bool", name: "done" },
        { type: "date", name: "doneAt" },
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
      indexes: ["CREATE INDEX idx_todos_user_list ON todos (user, list)"],
    })
    app.save(todos)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("todos"))
  },
)
