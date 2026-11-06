import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCog, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { DayTimeline, HourGutter } from '@/components/day-timeline'
import { EntryDialog, type EntryDialogTarget } from '@/components/entry-dialog'
import { LoadError, Loading } from '@/components/load-status'
import { MoodIcon } from '@/components/mood-icon'
import { OverrideDialog } from '@/components/override-dialog'
import { RatingDialog } from '@/components/rating-form'
import { ShiftBadge } from '@/components/shift-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canRate, type DayRating } from '@/lib/day-rating'
import {
  addDays,
  cycleWeek,
  CYCLE_WEEKS,
  daysBetween,
  entryTime,
  entryView,
  formatDayMonth,
  formatLongDay,
  formatWeekday,
  isDateKey,
  isoWeek,
  isWorkDay,
  minutesOf,
  relativeDay,
  shiftOn,
  sortEntries,
  spilledEntries,
  todayKey,
  weekOf,
  type ScheduleData,
  type ScheduleEntry,
} from '@/lib/schedule'
import { useDayRatings } from '@/lib/use-day-ratings'
import { useNow } from '@/lib/use-now'
import { useSchedule } from '@/lib/use-schedule'
import { useTodos, type Todo } from '@/lib/use-todos'
import { cn } from '@/lib/utils'

type View = 'day' | 'week'

const DAY_HOUR_HEIGHT = 48
const WEEK_HOUR_HEIGHT = 32

export function SchedulePage() {
  const schedule = useSchedule()
  const todoState = useTodos()
  const { ratings, save: saveRating } = useDayRatings()
  const now = useNow()
  const today = todayKey(now)
  const [params, setParams] = useSearchParams()
  const view: View = params.get('vy') === 'vecka' ? 'week' : 'day'
  const dateParam = params.get('datum')
  const date = isDateKey(dateParam) ? dateParam : today
  // Set by the "Schemalägg" button in Listor.
  const todoToSchedule = params.get('schemalagg')

  const [entryTarget, setEntryTarget] = useState<EntryDialogTarget | null>(null)
  const [overrideDate, setOverrideDate] = useState<string | null>(null)
  const [ratingDate, setRatingDate] = useState<string | null>(null)

  const go = (nextView: View, nextDate: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('vy', nextView === 'week' ? 'vecka' : 'dag')
        next.set('datum', nextDate)
        return next
      },
    )

  // The link from Listor opens the add dialog with the item already picked.
  const fromListor = useMemo<EntryDialogTarget | null>(
    () =>
      todoToSchedule && todoState.todos
        ? { mode: 'new', date, todoId: todoToSchedule }
        : null,
    [todoToSchedule, todoState.todos, date],
  )
  const closeEntryDialog = () => {
    setEntryTarget(null)
    if (todoToSchedule) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('schemalagg')
          return next
        },
        { replace: true },
      )
    }
  }

  const { data } = schedule
  const todos = todoState.todos

  if (!data || !todos) {
    const error = schedule.loadError ?? todoState.loadError
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-semibold">Schema</h1>
        {error ? (
          <div className="rounded-xl border">
            <LoadError
              message={error}
              onRetry={() => {
                schedule.retry()
                todoState.retry()
              }}
            />
          </div>
        ) : (
          <Loading>Hämtar schemat…</Loading>
        )}
      </section>
    )
  }

  const ratingOn = (key: string) => ratings?.find((item) => item.date === key)

  const toggleEntry = (entry: ScheduleEntry) => {
    const { todo } = entryView(entry, todos)
    if (todo) void todoState.toggle(todo)
    else void schedule.toggleEntry(entry)
  }

  const days = view === 'day' ? [date] : weekOf(date)
  const weekNumber = isoWeek(date)
  const shiftWeek = cycleWeek(data.cycle, date)
  const step = view === 'day' ? 1 : 7
  const isCurrent = view === 'day' ? date === today : days.includes(today)

  const ratingDay = ratingDate
    ? {
        date: ratingDate,
        title: formatLongDay(ratingDate),
        dayWord: ratingDate === today ? 'idag' : 'den dagen',
        workDay: isWorkDay(shiftOn(ratingDate, data)),
        existing: ratingOn(ratingDate),
      }
    : null

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Schema</h1>
        <div className="flex gap-2">
          <Link
            to="/schema/skift"
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11 lg:h-8')}
          >
            <CalendarCog aria-hidden />
            Skift
          </Link>
          <Button
            className="h-11 lg:h-8"
            onClick={() =>
              setEntryTarget({
                mode: 'new',
                date: view === 'day' ? date : days.includes(today) ? today : days[0],
              })
            }
          >
            <Plus aria-hidden />
            Lägg till
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(value) => go(value as View, date)}>
          <TabsList className="h-11 lg:h-9">
            <TabsTrigger value="day" className="px-4">
              Dag
            </TabsTrigger>
            <TabsTrigger value="week" className="px-4">
              Vecka
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-11 lg:size-8"
            aria-label={view === 'day' ? 'Föregående dag' : 'Föregående vecka'}
            onClick={() => go(view, addDays(date, -step))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="h-11 lg:h-8"
            disabled={isCurrent}
            onClick={() => go(view, today)}
          >
            Idag
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 lg:size-8"
            aria-label={view === 'day' ? 'Nästa dag' : 'Nästa vecka'}
            onClick={() => go(view, addDays(date, step))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold" aria-live="polite">
          {view === 'day'
            ? formatLongDay(date)
            : `Vecka ${weekNumber} · ${formatDayMonth(days[0])}–${formatDayMonth(days[6])}`}
        </span>
        {shiftWeek !== null && (
          <span className="text-xs text-muted-foreground">
            Skiftvecka {shiftWeek} av {CYCLE_WEEKS}
          </span>
        )}
      </p>

      {(!data.cycle || data.types.length === 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/60 bg-card p-3">
          <p className="text-sm">
            Lägg in dina skift och ditt {CYCLE_WEEKS}-veckorsschema så syns de här.
          </p>
          <Link
            to="/schema/skift"
            className={cn(buttonVariants(), 'h-11 shrink-0 lg:h-8')}
          >
            Ställ in skift
          </Link>
        </div>
      )}

      {schedule.actionError && (
        <p className="text-sm text-destructive" role="alert">
          {schedule.actionError}
        </p>
      )}
      {todoState.actionError && (
        <p className="text-sm text-destructive" role="alert">
          {todoState.actionError}
        </p>
      )}

      {view === 'day' ? (
        <DayView
          date={date}
          today={today}
          now={now}
          data={data}
          todos={todos}
          rating={ratingOn(date)}
          onOpenEntry={(entry) => setEntryTarget({ mode: 'edit', entry })}
          onToggleEntry={toggleEntry}
          onChangeDay={() => setOverrideDate(date)}
          onRate={() => setRatingDate(date)}
        />
      ) : (
        <WeekView
          days={days}
          today={today}
          now={now}
          data={data}
          todos={todos}
          ratingOn={ratingOn}
          onOpenDay={(key) => go('day', key)}
          onOpenEntry={(entry) => setEntryTarget({ mode: 'edit', entry })}
          onToggleEntry={toggleEntry}
        />
      )}

      <EntryDialog
        target={entryTarget ?? fromListor}
        onClose={closeEntryDialog}
        todos={todos}
        onSave={schedule.saveEntry}
        onRemove={schedule.removeEntry}
        onCreateTodo={todoState.add}
      />
      <OverrideDialog
        date={overrideDate}
        data={data}
        onClose={() => setOverrideDate(null)}
        onSave={(key, kind, shiftType) =>
          schedule.setOverride(
            key,
            kind,
            shiftType,
            data.overrides.find((item) => item.date === key),
          )
        }
      />
      <RatingDialog
        target={ratingDay}
        onClose={() => setRatingDate(null)}
        onSave={saveRating}
      />
    </section>
  )
}

function DayView({
  date,
  today,
  now,
  data,
  todos,
  rating,
  onOpenEntry,
  onToggleEntry,
  onChangeDay,
  onRate,
}: {
  date: string
  today: string
  now: number
  data: ScheduleData & { entries: ScheduleEntry[] }
  todos: Todo[]
  rating?: DayRating
  onOpenEntry: (entry: ScheduleEntry) => void
  onToggleEntry: (entry: ScheduleEntry) => void
  onChangeDay: () => void
  onRate: () => void
}) {
  const shift = shiftOn(date, data)
  const yesterdayShift = shiftOn(addDays(date, -1), data)
  const entries = sortEntries(data.entries.filter((entry) => entry.date === date))
  const allDay = entries.filter((entry) => entry.allDay)
  const timed = entries.filter((entry) => !entry.allDay)
  const spilled = spilledEntries(data.entries, date)
  const rateable = canRate(date, now)
  const isPast = date <= today

  const scroller = useRef<HTMLDivElement>(null)
  // Open the timeline a little before the first thing on the day, or at 07:00.
  const firstMinute = Math.min(
    ...timed.map((entry) => minutesOf(entry.start)),
    shift.kind === 'shift' ? minutesOf(shift.type.start) : 7 * 60,
    yesterdayShift.kind === 'shift' && minutesOf(yesterdayShift.type.end) <= minutesOf(yesterdayShift.type.start)
      ? 0
      : 24 * 60,
  )
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = Math.max(0, (firstMinute / 60 - 1) * DAY_HOUR_HEIGHT)
    }
  }, [date, firstMinute])

  const nowDate = new Date(now)
  const nowMinutes =
    date === today ? nowDate.getHours() * 60 + nowDate.getMinutes() : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        {Math.abs(daysBetween(today, date)) <= 1 && (
          <span className="text-sm text-muted-foreground">
            {relativeDay(date, today)}
          </span>
        )}
        <ShiftBadge shift={shift} />
        {shift.kind === 'none' && (
          <span className="text-sm text-muted-foreground">Inget skift</span>
        )}
        <Button variant="ghost" className="h-11 lg:h-8" onClick={onChangeDay}>
          Ändra dag
        </Button>
        <span className="ml-auto flex items-center gap-2">
          {rating && <MoodIcon rating={rating} showAverage />}
          {isPast && rateable && (
            <Button
              variant={rating ? 'ghost' : 'outline'}
              className="h-11 lg:h-8"
              onClick={onRate}
            >
              {rating ? 'Ändra betyg' : 'Betygsätt dagen'}
            </Button>
          )}
        </span>
      </div>

      {allDay.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {allDay.map((entry) => (
            <AllDayRow
              key={entry.id}
              entry={entry}
              todos={todos}
              onOpen={onOpenEntry}
              onToggle={onToggleEntry}
            />
          ))}
        </ul>
      )}

      <div
        ref={scroller}
        className="max-h-[65svh] overflow-y-auto rounded-xl border bg-card py-2 pr-2"
        aria-label="Dagens tidslinje"
        role="region"
      >
        <div className="flex">
          <HourGutter hourHeight={DAY_HOUR_HEIGHT} />
          <DayTimeline
            shift={shift}
            yesterdayShift={yesterdayShift}
            entries={timed}
            spilled={spilled}
            todos={todos}
            hourHeight={DAY_HOUR_HEIGHT}
            nowMinutes={nowMinutes}
            onOpenEntry={onOpenEntry}
            onToggleEntry={onToggleEntry}
          />
        </div>
      </div>
    </div>
  )
}

function AllDayRow({
  entry,
  todos,
  onOpen,
  onToggle,
}: {
  entry: ScheduleEntry
  todos: Todo[]
  onOpen: (entry: ScheduleEntry) => void
  onToggle: (entry: ScheduleEntry) => void
}) {
  const view = entryView(entry, todos)
  return (
    <li className="flex items-center gap-3 px-3">
      <Checkbox
        checked={view.done}
        onCheckedChange={() => onToggle(entry)}
        aria-label={`${view.done ? 'Markera som inte klar' : 'Markera som klar'}: ${view.title}`}
      />
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 py-2 text-left text-sm"
      >
        <span className={cn('min-w-0 break-words', view.done && 'text-muted-foreground line-through')}>
          {view.title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">Hela dagen</span>
      </button>
    </li>
  )
}

function WeekView({
  days,
  today,
  now,
  data,
  todos,
  ratingOn,
  onOpenDay,
  onOpenEntry,
  onToggleEntry,
}: {
  days: string[]
  today: string
  now: number
  data: ScheduleData & { entries: ScheduleEntry[] }
  todos: Todo[]
  ratingOn: (key: string) => DayRating | undefined
  onOpenDay: (key: string) => void
  onOpenEntry: (entry: ScheduleEntry) => void
  onToggleEntry: (entry: ScheduleEntry) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 6 * WEEK_HOUR_HEIGHT
  }, [])

  const nowDate = new Date(now)
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
  const dayEntries = (key: string) =>
    sortEntries(data.entries.filter((entry) => entry.date === key))

  return (
    <>
      {/* Phones: one row per day. */}
      <ol className="divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {days.map((key) => {
          const shift = shiftOn(key, data)
          const rating = key < today ? ratingOn(key) : undefined
          const entries = dayEntries(key)
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className={cn(
                  'flex w-full gap-3 p-3 text-left hover:bg-accent/40',
                  key === today && 'border-l-2 border-primary bg-accent/30',
                )}
                aria-label={`${formatLongDay(key)}. Öppna dagen`}
              >
                <span className="w-10 shrink-0 text-center">
                  <span className="block text-xs text-muted-foreground">
                    {formatWeekday(key)}
                  </span>
                  <span className="block text-lg font-semibold tabular-nums">
                    {Number(key.slice(8))}
                  </span>
                </span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex items-center justify-between gap-2">
                    <ShiftBadge shift={shift} />
                    {shift.kind === 'none' && <span />}
                    {rating && <MoodIcon rating={rating} />}
                  </span>
                  {entries.length > 0 && (
                    <span className="block space-y-0.5">
                      {entries.map((entry) => {
                        const view = entryView(entry, todos)
                        return (
                          <span key={entry.id} className="flex gap-2 text-sm">
                            <span className="w-24 shrink-0 text-xs leading-5 text-muted-foreground tabular-nums">
                              {entryTime(entry)}
                            </span>
                            <span
                              className={cn(
                                'min-w-0 truncate',
                                view.done && 'text-muted-foreground line-through',
                              )}
                            >
                              {view.title}
                            </span>
                          </span>
                        )
                      })}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Computers: seven columns on a shared hour timeline. */}
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <div className="flex border-b pr-2">
          <div className="w-11 shrink-0" />
          {days.map((key) => {
            const shift = shiftOn(key, data)
            const rating = key < today ? ratingOn(key) : undefined
            const allDay = dayEntries(key).filter((entry) => entry.allDay)
            return (
              <div
                key={key}
                className={cn(
                  'min-w-0 flex-1 space-y-1 border-l p-1.5',
                  key === today && 'bg-accent/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(key)}
                  className="flex w-full items-center justify-between gap-1 rounded-md px-1 text-left hover:bg-accent/60"
                  aria-label={`${formatLongDay(key)}. Öppna dagen`}
                >
                  <span className="text-sm">
                    <span className="text-muted-foreground">{formatWeekday(key)}</span>{' '}
                    <span className={cn('font-semibold tabular-nums', key === today && 'underline underline-offset-4')}>
                      {Number(key.slice(8))}
                    </span>
                  </span>
                  {rating && <MoodIcon rating={rating} />}
                </button>
                <ShiftBadge shift={shift} showTimes={false} className="flex w-full" />
                {allDay.map((entry) => {
                  const view = entryView(entry, todos)
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onOpenEntry(entry)}
                      className={cn(
                        'block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-xs hover:bg-accent/60',
                        view.done && 'text-muted-foreground line-through',
                      )}
                    >
                      {view.title}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div
          ref={scroller}
          className="max-h-[60svh] overflow-y-auto py-2 pr-2"
          role="region"
          aria-label="Veckans tidslinje"
        >
          <div className="flex">
            <HourGutter hourHeight={WEEK_HOUR_HEIGHT} />
            {days.map((key) => (
              <div key={key} className="flex min-w-0 flex-1 border-l">
                <DayTimeline
                  compact
                  shift={shiftOn(key, data)}
                  yesterdayShift={shiftOn(addDays(key, -1), data)}
                  entries={dayEntries(key).filter((entry) => !entry.allDay)}
                  spilled={spilledEntries(data.entries, key)}
                  todos={todos}
                  hourHeight={WEEK_HOUR_HEIGHT}
                  nowMinutes={key === today ? nowMinutes : undefined}
                  onOpenEntry={onOpenEntry}
                  onToggleEntry={onToggleEntry}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
