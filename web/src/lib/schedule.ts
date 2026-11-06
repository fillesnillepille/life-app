// Types and helpers for the Schema page: dates, the shift cycle, and laying
// out a day's shifts and entries on a timeline.

export type ShiftColor = 'blue' | 'violet' | 'amber' | 'cyan' | 'pink' | 'gray'

export type ShiftType = {
  id: string
  name: string
  // "07:00". An end at or before the start means the shift runs past midnight.
  start: string
  end: string
  color: ShiftColor
}

export type ShiftCycle = {
  id: string
  // "2026-11-02", the Monday of week 1.
  startDate: string
  // CYCLE_DAYS shift type ids. An empty string is a day off.
  days: string[]
}

export type OverrideKind = 'shift' | 'off' | 'vacation' | 'sick'

export type ShiftOverride = {
  id: string
  date: string
  kind: OverrideKind
  // Set when kind is "shift".
  shiftType: string
}

export type ScheduleEntry = {
  id: string
  title: string
  date: string
  allDay: boolean
  // "14:00", empty for all-day entries. An end at or before the start runs
  // past midnight.
  start: string
  end: string
  // The linked to-do item, or an empty string.
  todo: string
  // Used only when there is no linked to-do item.
  done: boolean
}

export type EntryValues = Omit<ScheduleEntry, 'id' | 'done'>

export const CYCLE_WEEKS = 5
export const CYCLE_DAYS = CYCLE_WEEKS * 7

export const shiftColors: { id: ShiftColor; label: string }[] = [
  { id: 'blue', label: 'Blå' },
  { id: 'violet', label: 'Lila' },
  { id: 'amber', label: 'Gul' },
  { id: 'cyan', label: 'Turkos' },
  { id: 'pink', label: 'Rosa' },
  { id: 'gray', label: 'Grå' },
]

const shiftColorVar = (color: ShiftColor) => `var(--shift-${color})`

// A coloured edge and faint fill in the shift's colour, behind white text.
export function shiftStyle(color: ShiftColor) {
  const value = shiftColorVar(color)
  return {
    borderColor: value,
    background: `color-mix(in oklab, ${value} 18%, transparent)`,
  }
}

export const offLabels: Record<Exclude<OverrideKind, 'shift'>, string> = {
  off: 'Ledig',
  vacation: 'Semester',
  sick: 'Sjuk',
}

// Dates ----------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

// "2026-11-06" for a local date.
export function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayKey(now: number = Date.now()) {
  return dateKey(new Date(now))
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return dateKey(parseDateKey(value)) === value
}

// Local midnight of the date.
export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// A day count that ignores daylight saving, for arithmetic on dates.
function dayNumber(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function addDays(key: string, days: number) {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from)

// Monday is 0 and Sunday 6.
export const weekdayIndex = (key: string) => (parseDateKey(key).getDay() + 6) % 7

export const mondayOf = (key: string) => addDays(key, -weekdayIndex(key))

export const weekOf = (key: string) =>
  Array.from({ length: 7 }, (_, index) => addDays(mondayOf(key), index))

// The ISO week number, which Swedish calendars show.
export function isoWeek(key: string) {
  const thursday = addDays(mondayOf(key), 3)
  const yearStart = `${thursday.slice(0, 4)}-01-01`
  return Math.floor(daysBetween(yearStart, thursday) / 7) + 1
}

const longDayFormat = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const shortDayFormat = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const weekdayFormat = new Intl.DateTimeFormat('sv-SE', { weekday: 'short' })
const dayMonthFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
})

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// "Fredag 6 november"
export const formatLongDay = (key: string) =>
  capitalise(longDayFormat.format(parseDateKey(key)))
// "fre 6 nov."
export const formatShortDay = (key: string) =>
  shortDayFormat.format(parseDateKey(key))
// "Fre"
export const formatWeekday = (key: string) =>
  capitalise(weekdayFormat.format(parseDateKey(key)).replace('.', ''))
// "6 nov."
export const formatDayMonth = (key: string) =>
  dayMonthFormat.format(parseDateKey(key))

// "Idag", "Igår", "Imorgon", or the short date.
export function relativeDay(key: string, today: string) {
  const diff = daysBetween(today, key)
  if (diff === 0) return 'Idag'
  if (diff === -1) return 'Igår'
  if (diff === 1) return 'Imorgon'
  return formatShortDay(key)
}

// Times ----------------------------------------------------------------------

export const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// Reads what was typed as a 24-hour time: "9" is 09:00, "930" is 09:30,
// "1400" and "14.00" are 14:00. Returns null for anything that isn't a time.
export function parseTime(text: string) {
  const cleaned = text.trim().replace(/[.,]/g, ':')
  let hours: string
  let minutes: string
  if (cleaned.includes(':')) {
    ;[hours, minutes = ''] = cleaned.split(':')
  } else if (/^\d{1,2}$/.test(cleaned)) {
    hours = cleaned
    minutes = '00'
  } else if (/^\d{3,4}$/.test(cleaned)) {
    hours = cleaned.slice(0, -2)
    minutes = cleaned.slice(-2)
  } else {
    return null
  }
  if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes || '0')) return null
  const time = `${hours.padStart(2, '0')}:${(minutes || '0').padStart(2, '0')}`
  return isTime(time) ? time : null
}

export function minutesOf(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeOf(minutes: number) {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0')
  return `${hours}:${String(wrapped % 60).padStart(2, '0')}`
}

export const crossesMidnight = (start: string, end: string) =>
  minutesOf(end) <= minutesOf(start)

// "07:00–16:00"
export const timeRange = (start: string, end: string) => `${start}–${end}`

// The cycle --------------------------------------------------------------------

// Which of the CYCLE_DAYS days a date falls on, or null without a cycle.
export function cycleDayIndex(cycle: ShiftCycle | null, key: string) {
  if (!cycle) return null
  const diff = daysBetween(cycle.startDate, key)
  return ((diff % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
}

// 1 to CYCLE_WEEKS, or null without a cycle.
export function cycleWeek(cycle: ShiftCycle | null, key: string) {
  const index = cycleDayIndex(cycle, key)
  return index === null ? null : Math.floor(index / 7) + 1
}

export type DayShift =
  // No cycle is set up yet.
  | { kind: 'none'; override: false }
  | { kind: 'shift'; type: ShiftType; override: boolean }
  | { kind: 'off' | 'vacation' | 'sick'; override: boolean }

export type ScheduleData = {
  types: ShiftType[]
  cycle: ShiftCycle | null
  overrides: ShiftOverride[]
}

// The shift on a date: a one-day change if there is one, otherwise the cycle.
export function shiftOn(key: string, data: ScheduleData): DayShift {
  const typeById = (id: string) => data.types.find((type) => type.id === id)
  const override = data.overrides.find((item) => item.date === key)
  if (override) {
    if (override.kind !== 'shift') return { kind: override.kind, override: true }
    const type = typeById(override.shiftType)
    return type
      ? { kind: 'shift', type, override: true }
      : { kind: 'off', override: true }
  }
  const index = cycleDayIndex(data.cycle, key)
  if (index === null || !data.cycle) return { kind: 'none', override: false }
  const type = typeById(data.cycle.days[index] ?? '')
  return type
    ? { kind: 'shift', type, override: false }
    : { kind: 'off', override: false }
}

export const isWorkDay = (shift: DayShift) => shift.kind === 'shift'

export function shiftLabel(shift: DayShift) {
  if (shift.kind === 'none') return ''
  if (shift.kind === 'shift') return shift.type.name
  return offLabels[shift.kind]
}

// The timeline -----------------------------------------------------------------

// Where a time range falls on a day, for one that starts on `date` and for one
// that started the day before and ran past midnight.
export function blocksFor(start: string, end: string) {
  const from = minutesOf(start)
  const to = minutesOf(end)
  const crosses = to <= from
  return {
    today: { from, to: crosses ? 1440 : to, pastMidnight: crosses },
    // The part that spills into the next day, if any.
    spill: crosses && to > 0 ? { from: 0, to } : null,
  }
}

// Places overlapping blocks side by side. Returns each block's lane and how
// many lanes its group of overlapping blocks needs.
export function layoutLanes<T extends { from: number; to: number }>(blocks: T[]) {
  const sorted = [...blocks].sort((a, b) => a.from - b.from || b.to - a.to)
  const placed: { block: T; lane: number; lanes: number }[] = []
  let group: { block: T; lane: number; lanes: number }[] = []
  let groupEnd = -1
  const closeGroup = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1))
    for (const item of group) item.lanes = lanes
    placed.push(...group)
    group = []
  }
  for (const block of sorted) {
    if (block.from >= groupEnd && group.length) closeGroup()
    const used = group
      .filter((item) => item.block.to > block.from)
      .map((item) => item.lane)
    let lane = 0
    while (used.includes(lane)) lane += 1
    group.push({ block, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, block.to)
  }
  if (group.length) closeGroup()
  return placed
}

// Entries in display order: all-day first, then by start time.
export function sortEntries(entries: ScheduleEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'sv')
  })
}

// Timed entries from the day before that run past midnight into `key`.
export function spilledEntries(entries: ScheduleEntry[], key: string) {
  const yesterday = addDays(key, -1)
  return entries.filter(
    (entry) =>
      entry.date === yesterday &&
      !entry.allDay &&
      crossesMidnight(entry.start, entry.end) &&
      minutesOf(entry.end) > 0,
  )
}

// Entries and to-do items ----------------------------------------------------

type TodoLike = { id: string; title: string; done: boolean }

// What an entry shows: a linked item's own title and done state, or the
// entry's when there's no item, or the item has been deleted.
export function entryView<T extends TodoLike>(entry: ScheduleEntry, todos: T[]) {
  const todo = entry.todo ? todos.find((item) => item.id === entry.todo) : undefined
  return {
    title: todo?.title ?? entry.title,
    done: todo ? todo.done : entry.done,
    todo,
  }
}

// "Hela dagen" or "14:00–15:00".
export const entryTime = (entry: ScheduleEntry) =>
  entry.allDay ? 'Hela dagen' : timeRange(entry.start, entry.end)
