import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'
import {
  CYCLE_DAYS,
  type EntryValues,
  type OverrideKind,
  type ScheduleEntry,
  type ShiftCycle,
  type ShiftOverride,
  type ShiftType,
} from '@/lib/schedule'

function describeError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Något gick fel.'
}

function currentUser() {
  const user = pb.authStore.record?.id
  if (!user) throw new Error('Du är inte inloggad.')
  return user
}

// Wraps a save so its error message says what failed.
async function attempt<T>(what: string, run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    throw new Error(`${what} ${describeError(error)}`, { cause: error })
  }
}

const options = { requestKey: null }

type State = {
  types: ShiftType[]
  cycle: ShiftCycle | null
  overrides: ShiftOverride[]
  entries: ScheduleEntry[]
}

// Everything the Schema page shows. It is small, one person's shifts and plans,
// so it's all loaded at once.
export function useSchedule() {
  const [state, setState] = useState<State | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [types, cycles, overrides, entries] = await Promise.all([
        pb
          .collection('shift_types')
          .getFullList<ShiftType>({ sort: 'start,name', ...options }),
        pb.collection('shift_cycles').getFullList<ShiftCycle>(options),
        pb
          .collection('shift_overrides')
          .getFullList<ShiftOverride>({ sort: 'date', ...options }),
        pb
          .collection('schedule_entries')
          .getFullList<ScheduleEntry>({ sort: 'date,start', ...options }),
      ])
      const cycle = cycles[0] ?? null
      setState({
        types,
        cycle: cycle && { ...cycle, days: normaliseDays(cycle.days) },
        overrides,
        entries,
      })
      setLoadError(null)
    } catch (error) {
      setLoadError(`Kunde inte hämta schemat. ${describeError(error)}`)
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

  const update = (change: (current: State) => State) =>
    setState((current) => (current ? change(current) : current))

  // Shift types -----------------------------------------------------------

  const saveType = useCallback(
    async (values: Omit<ShiftType, 'id'>, existingId?: string) => {
      const saved = await attempt('Kunde inte spara skiftet.', () =>
        existingId
          ? pb
              .collection('shift_types')
              .update<ShiftType>(existingId, values, options)
          : pb
              .collection('shift_types')
              .create<ShiftType>({ ...values, user: currentUser() }, options),
      )
      update((current) => ({
        ...current,
        types: [
          ...current.types.filter((type) => type.id !== saved.id),
          saved,
        ].sort((a, b) => a.start.localeCompare(b.start)),
      }))
    },
    [],
  )

  // Deleting a type also clears it from the cycle. PocketBase removes the
  // one-day changes that used it.
  const removeType = useCallback(
    async (type: ShiftType, cycle: ShiftCycle | null) => {
      await attempt('Kunde inte ta bort skiftet.', async () => {
        if (cycle?.days.includes(type.id)) {
          const days = cycle.days.map((id) => (id === type.id ? '' : id))
          await pb.collection('shift_cycles').update(cycle.id, { days }, options)
        }
        await pb.collection('shift_types').delete(type.id, options)
      })
      update((current) => ({
        ...current,
        types: current.types.filter((item) => item.id !== type.id),
        cycle: current.cycle && {
          ...current.cycle,
          days: current.cycle.days.map((id) => (id === type.id ? '' : id)),
        },
        overrides: current.overrides.filter(
          (item) => item.shiftType !== type.id,
        ),
      }))
    },
    [],
  )

  // The cycle ---------------------------------------------------------------

  const saveCycle = useCallback(
    async (startDate: string, days: string[], existingId?: string) => {
      const saved = await attempt('Kunde inte spara schemat.', () =>
        existingId
          ? pb
              .collection('shift_cycles')
              .update<ShiftCycle>(existingId, { startDate, days }, options)
          : pb
              .collection('shift_cycles')
              .create<ShiftCycle>(
                { startDate, days, user: currentUser() },
                options,
              ),
      )
      update((current) => ({
        ...current,
        cycle: { ...saved, days: normaliseDays(saved.days) },
      }))
    },
    [],
  )

  // One-day changes ----------------------------------------------------------

  // Sets the change for a date, or with kind null goes back to the cycle.
  const setOverride = useCallback(
    async (
      date: string,
      kind: OverrideKind | null,
      shiftType: string,
      existing?: ShiftOverride,
    ) => {
      if (kind === null) {
        if (!existing) return
        await attempt('Kunde inte ändra dagen.', () =>
          pb.collection('shift_overrides').delete(existing.id, options),
        )
        update((current) => ({
          ...current,
          overrides: current.overrides.filter((item) => item.id !== existing.id),
        }))
        return
      }
      const values = { kind, shiftType: kind === 'shift' ? shiftType : '' }
      const saved = await attempt('Kunde inte ändra dagen.', () =>
        existing
          ? pb
              .collection('shift_overrides')
              .update<ShiftOverride>(existing.id, values, options)
          : pb
              .collection('shift_overrides')
              .create<ShiftOverride>(
                { ...values, date, user: currentUser() },
                options,
              ),
      )
      update((current) => ({
        ...current,
        overrides: [
          ...current.overrides.filter((item) => item.id !== saved.id),
          saved,
        ],
      }))
    },
    [],
  )

  // Entries ------------------------------------------------------------------

  const saveEntry = useCallback(
    async (values: EntryValues, existingId?: string) => {
      const saved = await attempt('Kunde inte spara.', () =>
        existingId
          ? pb
              .collection('schedule_entries')
              .update<ScheduleEntry>(existingId, values, options)
          : pb
              .collection('schedule_entries')
              .create<ScheduleEntry>(
                { ...values, done: false, user: currentUser() },
                options,
              ),
      )
      update((current) => ({
        ...current,
        entries: [
          ...current.entries.filter((item) => item.id !== saved.id),
          saved,
        ],
      }))
      return saved
    },
    [],
  )

  const removeEntry = useCallback(async (entry: ScheduleEntry) => {
    await attempt('Kunde inte ta bort.', () =>
      pb.collection('schedule_entries').delete(entry.id, options),
    )
    update((current) => ({
      ...current,
      entries: current.entries.filter((item) => item.id !== entry.id),
    }))
  }, [])

  // Ticks an entry with no to-do item. Linked entries tick the item instead.
  const toggleEntry = useCallback(async (entry: ScheduleEntry) => {
    const replace = (next: ScheduleEntry) =>
      update((current) => ({
        ...current,
        entries: current.entries.map((item) =>
          item.id === next.id ? next : item,
        ),
      }))
    replace({ ...entry, done: !entry.done })
    try {
      await pb
        .collection('schedule_entries')
        .update(entry.id, { done: !entry.done }, options)
      setActionError(null)
    } catch (error) {
      replace(entry)
      setActionError(`Kunde inte spara ändringen. ${describeError(error)}`)
    }
  }, [])

  return {
    data: state,
    loadError,
    actionError,
    setActionError,
    retry,
    saveType,
    removeType,
    saveCycle,
    setOverride,
    saveEntry,
    removeEntry,
    toggleEntry,
  }
}

export type Schedule = ReturnType<typeof useSchedule>

// Always CYCLE_DAYS long, whatever was stored.
function normaliseDays(days: unknown) {
  const list = Array.isArray(days) ? days : []
  return Array.from({ length: CYCLE_DAYS }, (_, index) =>
    typeof list[index] === 'string' ? (list[index] as string) : '',
  )
}

// For Listor: the entries that point to a to-do item, by item id, soonest
// first. Failing to load them only hides the "Schemalagd" notes.
export function useScheduledTodos() {
  const [byTodo, setByTodo] = useState<Map<string, ScheduleEntry[]>>(new Map())

  useEffect(() => {
    let cancelled = false
    pb.collection('schedule_entries')
      .getFullList<ScheduleEntry>({
        filter: "todo != ''",
        sort: 'date,start',
        ...options,
      })
      .then((entries) => {
        if (cancelled) return
        const map = new Map<string, ScheduleEntry[]>()
        for (const entry of entries) {
          map.set(entry.todo, [...(map.get(entry.todo) ?? []), entry])
        }
        setByTodo(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return byTodo
}
