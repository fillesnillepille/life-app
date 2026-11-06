import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TimeField } from '@/components/time-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import {
  crossesMidnight,
  isDateKey,
  isTime,
  minutesOf,
  timeOf,
  type EntryValues,
  type ScheduleEntry,
} from '@/lib/schedule'
import { lists } from '@/lib/todo-lists'
import type { Todo, TodoListId } from '@/lib/use-todos'

// What the entry is linked to: nothing, a new list item, or an existing one.
const NONE = 'none'
const NEW = 'new'

export type EntryDialogTarget =
  | { mode: 'new'; date: string; todoId?: string; start?: string }
  | { mode: 'edit'; entry: ScheduleEntry }

export function EntryDialog({
  target,
  onClose,
  todos,
  onSave,
  onRemove,
  onCreateTodo,
}: {
  // The dialog is open while this is set.
  target: EntryDialogTarget | null
  onClose: () => void
  todos: Todo[]
  onSave: (values: EntryValues, existingId?: string) => Promise<unknown>
  onRemove: (entry: ScheduleEntry) => Promise<void>
  onCreateTodo: (list: TodoListId, title: string) => Promise<Todo | null>
}) {
  // Keep the last target while the dialog fades out, so it doesn't blank.
  const [shown, setShown] = useState(target)
  if (target && target !== shown) setShown(target)

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
      >
        {shown && (
          <EntryForm
            key={shown.mode === 'edit' ? shown.entry.id : `new-${shown.date}-${shown.todoId ?? ''}`}
            target={shown}
            todos={todos}
            onClose={onClose}
            onSave={onSave}
            onRemove={onRemove}
            onCreateTodo={onCreateTodo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EntryForm({
  target,
  todos,
  onClose,
  onSave,
  onRemove,
  onCreateTodo,
}: {
  target: EntryDialogTarget
  todos: Todo[]
  onClose: () => void
  onSave: (values: EntryValues, existingId?: string) => Promise<unknown>
  onRemove: (entry: ScheduleEntry) => Promise<void>
  onCreateTodo: (list: TodoListId, title: string) => Promise<Todo | null>
}) {
  const existing = target.mode === 'edit' ? target.entry : undefined
  const initialStart =
    existing?.start || (target.mode === 'new' && target.start) || '09:00'
  const [link, setLink] = useState(
    existing?.todo || (target.mode === 'new' && target.todoId) || NONE,
  )
  const [title, setTitle] = useState(existing?.title ?? '')
  const [newList, setNewList] = useState<TodoListId>('daily')
  const [date, setDate] = useState(
    existing?.date ?? (target.mode === 'new' ? target.date : ''),
  )
  const [allDay, setAllDay] = useState(existing?.allDay ?? false)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(
    existing?.end || timeOf(minutesOf(initialStart) + 60),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const linkedTodo =
    link !== NONE && link !== NEW ? todos.find((todo) => todo.id === link) : undefined
  // Open items to pick from, plus the linked one even if it's done.
  const choices = (listId: TodoListId) =>
    todos.filter(
      (todo) => todo.list === listId && (!todo.done || todo.id === link),
    )

  // Moving the start keeps the length, as calendars do.
  const changeStart = (value: string) => {
    if (isTime(value) && isTime(start) && isTime(end)) {
      const length = (minutesOf(end) - minutesOf(start) + 1440) % 1440 || 60
      setEnd(timeOf(minutesOf(value) + length))
    }
    setStart(value)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const name = linkedTodo ? linkedTodo.title : title.trim()
    if (!name) return setError('Skriv vad det gäller.')
    if (!isDateKey(date)) return setError('Välj ett datum.')
    if (!allDay && (!isTime(start) || !isTime(end))) {
      return setError('Fyll i start- och sluttid.')
    }
    if (!allDay && start === end) {
      return setError('Sluttiden måste skilja sig från starttiden.')
    }
    setBusy(true)
    setError(null)
    try {
      let todo = linkedTodo?.id ?? ''
      if (link === NEW) {
        const created = await onCreateTodo(newList, name)
        if (!created) throw new Error('Kunde inte lägga till i listan.')
        todo = created.id
      }
      await onSave(
        {
          title: name,
          date,
          allDay,
          start: allDay ? '' : start,
          end: allDay ? '' : end,
          // Keep a link to an item that has since been deleted only if it was
          // already there, so the entry doesn't lose it by being edited.
          todo: todo || (link === existing?.todo ? existing.todo : ''),
        },
        existing?.id,
      )
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await onRemove(existing)
      onClose()
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : 'Något gick fel.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Ändra i schemat' : 'Lägg till i schemat'}</DialogTitle>
        <DialogDescription>
          Koppla till en uppgift i Listor, så bockas den av på båda ställena.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-link">Uppgift</Label>
        <NativeSelect
          id="entry-link"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          className="w-full [&_select]:h-11 lg:[&_select]:h-9"
        >
          <NativeSelectOption value={NONE}>Ingen koppling</NativeSelectOption>
          <NativeSelectOption value={NEW}>Ny uppgift i en lista</NativeSelectOption>
          {lists.map((list) => {
            const items = choices(list.id)
            if (items.length === 0) return null
            return (
              <NativeSelectOptGroup key={list.id} label={list.tab}>
                {items.map((todo) => (
                  <NativeSelectOption key={todo.id} value={todo.id}>
                    {todo.title}
                    {todo.done ? ' (klar)' : ''}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )
          })}
          {link !== NONE && link !== NEW && !linkedTodo && (
            <NativeSelectOption value={link}>
              {existing?.title} (borttagen ur listan)
            </NativeSelectOption>
          )}
        </NativeSelect>
      </div>

      {link === NEW && (
        <div className="grid gap-1.5">
          <Label htmlFor="entry-list">Lista</Label>
          <NativeSelect
            id="entry-list"
            value={newList}
            onChange={(event) => setNewList(event.target.value as TodoListId)}
            className="w-full [&_select]:h-11 lg:[&_select]:h-9"
          >
            {lists.map((list) => (
              <NativeSelectOption key={list.id} value={list.id}>
                {list.tab}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}

      {!linkedTodo && (
        <div className="grid gap-1.5">
          <Label htmlFor="entry-title">Titel</Label>
          <Input
            id="entry-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder={link === NEW ? 'Ny uppgift' : 'Vad ska hända?'}
            className="h-11 text-base lg:h-9"
          />
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="entry-date">Datum</Label>
        <Input
          id="entry-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 text-base lg:h-9"
        />
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Hela dagen
        <Switch checked={allDay} onCheckedChange={setAllDay} />
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="entry-start">Start</Label>
            <TimeField
              id="entry-start"
              value={start}
              onChange={changeStart}
              className="h-11 text-base lg:h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-end">Slut</Label>
            <TimeField
              id="entry-end"
              value={end}
              onChange={setEnd}
              className="h-11 text-base lg:h-9"
            />
          </div>
          {isTime(start) && isTime(end) && start !== end && crossesMidnight(start, end) && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Slutar dagen efter.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter>
        {existing &&
          (confirmRemove ? (
            <Button
              type="button"
              variant="destructive"
              className="h-11 sm:mr-auto lg:h-8"
              disabled={busy}
              onClick={remove}
            >
              {existing.todo ? 'Ja, ta bort ur schemat' : 'Ja, ta bort'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-11 sm:mr-auto lg:h-8"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
            >
              Ta bort
            </Button>
          ))}
        <Button
          type="button"
          variant="outline"
          className="h-11 lg:h-8"
          onClick={onClose}
        >
          Avbryt
        </Button>
        <Button type="submit" className="h-11 lg:h-8" disabled={busy}>
          Spara
        </Button>
      </DialogFooter>
    </form>
  )
}
