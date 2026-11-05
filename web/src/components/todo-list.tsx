import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { LoadError, Loading } from '@/components/load-status'
import { Panel } from '@/components/panel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { lists, type ListConfig } from '@/lib/todo-lists'
import { useNow } from '@/lib/use-now'
import { useTodos, type Todo } from '@/lib/use-todos'
import { cn } from '@/lib/utils'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(time: number) {
  const date = new Date(time)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime()
}

// PocketBase writes dates as "2026-11-05 21:24:52.883Z". Safari only accepts
// the "T" form, so normalise before parsing.
function parseDate(value: string) {
  return new Date(value.replace(' ', 'T'))
}

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
})
const yearDateFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatWhen(value: string, withTime: boolean) {
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const format =
    date.getFullYear() === new Date().getFullYear() ? dateFormat : yearDateFormat
  const day = format.format(date)
  return withTime ? `${day} ${timeFormat.format(date)}` : day
}

// The daily list on its own, with its own loading and error states, for pages
// that show just that list.
export function DailyTodosPanel() {
  const { todos, loadError, actionError, retry, add, toggle, remove } =
    useTodos()
  const now = useNow()
  const config = lists[0]

  if (!todos) {
    return (
      <Panel title={config.title}>
        {loadError ? (
          <LoadError message={loadError} onRetry={retry} />
        ) : (
          <Loading>Hämtar uppgifter…</Loading>
        )}
      </Panel>
    )
  }

  return (
    <TodoList
      config={config}
      now={now}
      todos={todos.filter((todo) => todo.list === config.id)}
      actionError={actionError}
      onAdd={(title) => add(config.id, title)}
      onToggle={toggle}
      onRemove={remove}
    />
  )
}

export function TodoList({
  config,
  now,
  todos,
  actionError,
  onAdd,
  onToggle,
  onRemove,
}: {
  config: ListConfig
  now: number
  todos: Todo[]
  actionError: string | null
  onAdd: (title: string) => Promise<boolean>
  onToggle: (todo: Todo) => void
  onRemove: (todo: Todo) => void
}) {
  const [title, setTitle] = useState('')
  // The item waiting for the user to confirm its removal. It stays set while
  // the dialog fades out, so the text doesn't blank during the animation.
  const [target, setTarget] = useState<Todo | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function askToRemove(todo: Todo) {
    setTarget(todo)
    setConfirmOpen(true)
  }

  function confirmRemove() {
    if (target) onRemove(target)
    setConfirmOpen(false)
  }

  // The daily list starts fresh each morning: what was finished earlier stays
  // saved, but isn't shown.
  const visible =
    config.id === 'daily'
      ? todos.filter(
          (todo) =>
            !todo.done ||
            (todo.doneAt &&
              parseDate(todo.doneAt).getTime() >= startOfDay(now)),
        )
      : todos
  const open = visible.filter((todo) => !todo.done)
  const done = visible.filter((todo) => todo.done)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    // Clear at once so quick follow-up items aren't wiped when saving
    // finishes. Put the text back only if saving failed.
    setTitle('')
    if (!(await onAdd(trimmed))) setTitle((current) => current || trimmed)
  }

  return (
    <Panel
      title={config.title}
      meta={`${open.length} ${open.length === 1 ? 'öppen' : 'öppna'}`}
    >
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-b p-3"
      >
        <Input
          aria-label={config.placeholder}
          placeholder={config.placeholder}
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 lg:h-8"
        />
        <Button
          type="submit"
          disabled={!title.trim()}
          className="h-11 shrink-0 lg:h-8"
        >
          <Plus data-icon="inline-start" aria-hidden />
          Lägg till
        </Button>
      </form>

      {actionError && (
        <p className="border-b p-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {visible.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">{config.empty}</p>
      )}

      {open.length > 0 && (
        <ul className="divide-y">
          {open.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              daily={config.id === 'daily'}
              now={now}
              doneLabel={config.doneLabel ?? 'Klar'}
              onToggle={onToggle}
              onRemove={askToRemove}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <h3
            className={cn(
              'border-y bg-muted/40 px-3 py-1.5 text-xs tracking-widest text-muted-foreground uppercase',
              open.length === 0 && 'border-t-0',
            )}
          >
            {config.doneHeading ?? 'Klara uppgifter'}
          </h3>
          <ul className="divide-y">
            {done.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                daily={config.id === 'daily'}
                now={now}
                doneLabel={config.doneLabel ?? 'Klar'}
                onToggle={onToggle}
                onRemove={askToRemove}
              />
            ))}
          </ul>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort från listan?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              ”{target?.title}” tas bort för gott.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}

function TodoRow({
  todo,
  daily,
  now,
  doneLabel,
  onToggle,
  onRemove,
}: {
  todo: Todo
  // Daily items show the time of day too, and are flagged when they go stale.
  daily: boolean
  now: number
  doneLabel: string
  onToggle: (todo: Todo) => void
  onRemove: (todo: Todo) => void
}) {
  const added = formatWhen(todo.created, daily)
  const finished = todo.doneAt ? formatWhen(todo.doneAt, daily) : ''
  const overdue =
    daily &&
    !todo.done &&
    now - parseDate(todo.created).getTime() > DAY_MS

  return (
    <li className="flex items-center gap-1 pr-1">
      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
        <Checkbox checked={todo.done} onCheckedChange={() => onToggle(todo)} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'flex min-w-0 items-baseline gap-2 break-words',
              todo.done && 'text-muted-foreground line-through',
            )}
          >
            {overdue && (
              <span
                role="img"
                aria-label="Äldre än en dag"
                title="Äldre än en dag"
                className="font-bold text-destructive no-underline"
              >
                !
              </span>
            )}
            {todo.title}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {added && `Tillagd ${added}`}
            {finished && ` · ${doneLabel} ${finished}`}
          </span>
        </span>
      </label>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-muted-foreground lg:size-8"
        aria-label={`Ta bort ${todo.title}`}
        onClick={() => onRemove(todo)}
      >
        <X aria-hidden />
      </Button>
    </li>
  )
}
