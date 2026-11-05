import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'

export type TodoListId = 'daily' | 'longterm' | 'bucket' | 'shopping'

export type Todo = {
  id: string
  title: string
  list: TodoListId
  done: boolean
  // An empty string when the item isn't done.
  doneAt: string
  created: string
}

const collection = () => pb.collection('todos')

function describeError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Något gick fel.'
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await collection().getFullList<Todo>({
        sort: '-created',
        requestKey: null,
      })
      setTodos(items)
      setLoadError(null)
    } catch (error) {
      setLoadError(`Kunde inte hämta listorna. ${describeError(error)}`)
    }
  }, [])

  useEffect(() => {
    const run = () => void load()
    run()
  }, [load])

  const retry = useCallback(() => {
    setLoadError(null)
    void load()
  }, [load])

  const add = useCallback(async (list: TodoListId, title: string) => {
    const user = pb.authStore.record?.id
    if (!user) return false
    try {
      const created = await collection().create<Todo>(
        { title, list, done: false, user },
        { requestKey: null },
      )
      setTodos((current) => [created, ...(current ?? [])])
      setActionError(null)
      return true
    } catch (error) {
      setActionError(`Kunde inte lägga till. ${describeError(error)}`)
      return false
    }
  }, [])

  const toggle = useCallback(async (todo: Todo) => {
    const done = !todo.done
    const doneAt = done ? new Date().toISOString() : ''
    const replace = (next: Todo) =>
      setTodos((current) =>
        current?.map((item) => (item.id === next.id ? next : item)) ?? null,
      )
    replace({ ...todo, done, doneAt })
    try {
      await collection().update(todo.id, { done, doneAt }, { requestKey: null })
      setActionError(null)
    } catch (error) {
      replace(todo)
      setActionError(`Kunde inte spara ändringen. ${describeError(error)}`)
    }
  }, [])

  const remove = useCallback(async (todo: Todo) => {
    setTodos((current) => current?.filter((item) => item.id !== todo.id) ?? null)
    try {
      await collection().delete(todo.id, { requestKey: null })
      setActionError(null)
    } catch (error) {
      setTodos((current) => [todo, ...(current ?? [])])
      setActionError(`Kunde inte ta bort. ${describeError(error)}`)
    }
  }, [])

  return { todos, loadError, actionError, retry, add, toggle, remove }
}
