// What the AI is allowed to read, and nothing else. Mail and money have no
// function here on purpose. Every read uses the signed-in user's own token, so
// PocketBase's owner-only rules apply as they do in the app.

type Fetch = typeof fetch

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000
const CYCLE_DAYS = 35

export class UserDataError extends Error {}

export type UserData = {
  todos(list?: string): Promise<unknown>
  schedule(from: string, to: string): Promise<unknown>
  dayRatings(from: string, to: string): Promise<unknown>
  garminSummary(days: number, today: string): Promise<unknown>
}

function checkDates(...dates: string[]) {
  for (const date of dates) {
    if (!DATE.test(date)) throw new UserDataError('Datum ska vara ÅÅÅÅ-MM-DD.')
  }
}

function dayNumber(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function addDays(key: string, days: number) {
  const date = new Date((dayNumber(key) + days) * DAY_MS)
  return date.toISOString().slice(0, 10)
}

type ShiftType = { id: string; name: string; start: string; end: string }
type Cycle = { startDate: string; days: string[] }
type Override = { date: string; kind: string; shiftType: string }

// The shift on a date: its override if there is one, otherwise the day of the
// cycle. Mirrors the app's rule in web/src/lib/schedule.ts.
export function shiftOn(
  date: string,
  cycle: Cycle | undefined,
  types: Map<string, ShiftType>,
  overrides: Map<string, Override>,
) {
  const label = (type: ShiftType | undefined) =>
    type ? `${type.name} ${type.start}-${type.end}` : 'Ledig'
  const override = overrides.get(date)
  if (override) {
    if (override.kind === 'shift') return label(types.get(override.shiftType))
    return { off: 'Ledig', vacation: 'Semester', sick: 'Sjuk' }[override.kind]
  }
  if (!cycle || cycle.days.length !== CYCLE_DAYS) return null
  const offset = dayNumber(date) - dayNumber(cycle.startDate)
  const index = ((offset % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
  return label(types.get(cycle.days[index]))
}

const average = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) /
      10
    : null

export function createUserData(options: {
  pocketBaseUrl: string
  token: string
  fetch?: Fetch
}): UserData {
  const doFetch = options.fetch ?? fetch

  async function list<T>(collection: string, filter: string, sort: string) {
    const query = new URLSearchParams({
      perPage: '200',
      sort,
      ...(filter ? { filter } : {}),
    })
    const response = await doFetch(
      `${options.pocketBaseUrl}/api/collections/${collection}/records?${query}`,
      { headers: { Authorization: options.token } },
    )
    if (!response.ok) throw new UserDataError('Kunde inte läsa data.')
    return ((await response.json()) as { items: T[] }).items
  }

  return {
    async todos(listName) {
      const filter = ['daily', 'longterm', 'bucket', 'shopping'].includes(
        listName ?? '',
      )
        ? `list = "${listName}"`
        : ''
      const items = await list<{
        title: string
        list: string
        done: boolean
      }>('todos', filter, '-created')
      return items.map(({ title, list, done }) => ({ title, list, done }))
    },

    async schedule(from, to) {
      checkDates(from, to)
      if (dayNumber(to) - dayNumber(from) > 62) {
        throw new UserDataError('Högst 62 dagar åt gången.')
      }
      const range = `date >= "${from}" && date <= "${to}"`
      const [entries, overrides, types, cycles] = await Promise.all([
        list<{
          title: string
          date: string
          allDay: boolean
          start: string
          end: string
          done: boolean
        }>('schedule_entries', range, 'date,start'),
        list<Override>('shift_overrides', range, 'date'),
        list<ShiftType>('shift_types', '', 'name'),
        list<Cycle>('shift_cycles', '', 'created'),
      ])
      const typeMap = new Map(types.map((t) => [t.id, t]))
      const overrideMap = new Map(overrides.map((o) => [o.date, o]))
      const days = []
      for (let d = from; dayNumber(d) <= dayNumber(to); d = addDays(d, 1)) {
        days.push({
          date: d,
          shift: shiftOn(d, cycles[0], typeMap, overrideMap),
          entries: entries
            .filter((e) => e.date === d)
            .map((e) => ({
              title: e.title,
              time: e.allDay ? 'heldag' : `${e.start}-${e.end}`,
              done: e.done,
            })),
        })
      }
      return days
    },

    async dayRatings(from, to) {
      checkDates(from, to)
      const items = await list<Record<string, unknown>>(
        'day_ratings',
        `date >= "${from}" && date <= "${to}"`,
        'date',
      )
      return items.map((r) => ({
        date: r.date,
        worked: r.worked,
        work: r.work,
        exercise: r.exercise,
        food: r.food,
        social: r.social,
        creativity: r.creativity,
        general: r.general,
        comment: r.comment,
      }))
    },

    // Averages only, never the day-by-day numbers.
    async garminSummary(days, today) {
      checkDates(today)
      const count = Math.min(Math.max(Math.trunc(days) || 7, 1), 30)
      const from = addDays(today, -(count - 1))
      const range = `date >= "${from}" && date <= "${today}"`
      const [daysData, activities] = await Promise.all([
        list<Record<string, number>>('garmin_days', range, 'date'),
        list<{ type: string; duration: number }>(
          'garmin_activities',
          range,
          'date',
        ),
      ])
      // Missing numbers are stored as 0, so leave those out of the averages.
      const avg = (key: string, scale = 1) =>
        average(
          daysData
            .map((d) => d[key])
            .filter((v) => v > 0)
            .map((v) => v / scale),
        )
      const byType: Record<string, { count: number; minutes: number }> = {}
      for (const a of activities) {
        const entry = (byType[a.type] ??= { count: 0, minutes: 0 })
        entry.count += 1
        entry.minutes += Math.round(a.duration / 60)
      }
      return {
        from,
        to: today,
        daysWithData: daysData.length,
        averageSleepHours: avg('sleep', 3600),
        averageSleepScore: avg('sleepScore'),
        averageHrv: avg('hrvLastNight'),
        averageRestingHr: avg('restingHr'),
        averageSteps: avg('steps'),
        averageStress: avg('stress'),
        activities: byType,
      }
    },
  }
}
