import { Loading, LoadError } from '@/components/load-status'
import { TodoList } from '@/components/todo-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { lists } from '@/lib/todo-lists'
import { useNow } from '@/lib/use-now'
import { useScheduledTodos } from '@/lib/use-schedule'
import { useTodos } from '@/lib/use-todos'

export function TasksPage() {
  const { todos, loadError, actionError, retry, add, toggle, remove } =
    useTodos()
  const now = useNow()
  const scheduled = useScheduledTodos()

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Listor</h1>

      {loadError && !todos && (
        <div className="rounded-xl border">
          <LoadError message={loadError} onRetry={retry} />
        </div>
      )}

      {!todos && !loadError && <Loading>Hämtar listorna…</Loading>}

      {todos && (
        <Tabs defaultValue="daily" className="gap-4">
          <TabsList className="h-11 w-full lg:h-9 lg:w-fit">
            {lists.map((list) => (
              <TabsTrigger
                key={list.id}
                value={list.id}
                className="px-1 text-[13px] lg:px-4 lg:text-sm"
              >
                {list.tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {lists.map((list) => (
            <TabsContent key={list.id} value={list.id}>
              <TodoList
                config={list}
                now={now}
                todos={todos.filter((todo) => todo.list === list.id)}
                actionError={actionError}
                onAdd={(title) => add(list.id, title)}
                onToggle={toggle}
                onRemove={remove}
                scheduled={scheduled}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}
