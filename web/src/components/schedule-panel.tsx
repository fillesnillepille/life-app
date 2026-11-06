import { Link } from 'react-router'
import { LoadError, Loading } from '@/components/load-status'
import { Panel } from '@/components/panel'
import { ShiftBadge } from '@/components/shift-badge'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  addDays,
  crossesMidnight,
  CYCLE_WEEKS,
  cycleWeek,
  entryTime,
  entryView,
  minutesOf,
  shiftOn,
  sortEntries,
  todayKey,
  type ScheduleEntry,
} from '@/lib/schedule'
import type { Schedule } from '@/lib/use-schedule'
import type { useTodos } from '@/lib/use-todos'
import { cn } from '@/lib/utils'

// Today's and tomorrow's shift and today's entries, for Idag.
export function SchedulePanel({
  schedule,
  todoState,
  now,
}: {
  schedule: Schedule
  todoState: ReturnType<typeof useTodos>
  now: number
}) {
  const { data } = schedule
  const todos = todoState.todos
  const today = todayKey(now)
  const tomorrow = addDays(today, 1)
  const week = data ? cycleWeek(data.cycle, today) : null

  if (!data || !todos) {
    const error = schedule.loadError ?? todoState.loadError
    return (
      <Panel title="Schema">
        {error ? (
          <LoadError message={error} onRetry={schedule.retry} />
        ) : (
          <Loading>Hämtar schemat…</Loading>
        )}
      </Panel>
    )
  }

  const shift = shiftOn(today, data)
  const yesterdayShift = shiftOn(addDays(today, -1), data)
  const tomorrowShift = shiftOn(tomorrow, data)
  const date = new Date(now)
  const nowMinutes = date.getHours() * 60 + date.getMinutes()
  // A night shift from yesterday that's still going.
  const ongoing =
    yesterdayShift.kind === 'shift' &&
    crossesMidnight(yesterdayShift.type.start, yesterdayShift.type.end) &&
    nowMinutes < minutesOf(yesterdayShift.type.end)
      ? yesterdayShift
      : null
  const entries = sortEntries(data.entries.filter((entry) => entry.date === today))
  const tomorrowCount = data.entries.filter((entry) => entry.date === tomorrow).length
  const next = entries.find(
    (entry) =>
      !entry.allDay &&
      !entryView(entry, todos).done &&
      minutesOf(entry.start) >= nowMinutes,
  )

  const toggle = (entry: ScheduleEntry) => {
    const { todo } = entryView(entry, todos)
    if (todo) void todoState.toggle(todo)
    else void schedule.toggleEntry(entry)
  }

  return (
    <Panel
      title="Schema"
      meta={week ? `Skiftvecka ${week} av ${CYCLE_WEEKS}` : undefined}
    >
      <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
        <span className="w-16 shrink-0 text-muted-foreground">Idag</span>
        {shift.kind === 'none' ? (
          <span className="text-muted-foreground">Inget skiftschema inlagt</span>
        ) : (
          <ShiftBadge shift={shift} />
        )}
        {ongoing && (
          <span className="text-xs text-muted-foreground">
            {ongoing.type.name} från igår pågår till {ongoing.type.end}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="border-b p-3 text-sm text-muted-foreground">
          Inget inplanerat idag.
        </p>
      ) : (
        <ol className="divide-y border-b">
          {entries.map((entry) => {
            const view = entryView(entry, todos)
            const isNext = entry === next
            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 border-l-2 border-transparent px-3 text-sm',
                  isNext && 'border-primary bg-accent/40',
                )}
              >
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
                  <Checkbox checked={view.done} onCheckedChange={() => toggle(entry)} />
                  <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {entryTime(entry)}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 break-words',
                      view.done && 'text-muted-foreground line-through',
                    )}
                  >
                    {view.title}
                  </span>
                </label>
                {isNext && (
                  <span className="text-[10px] tracking-widest text-primary">
                    NÄSTA
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {(schedule.actionError || todoState.actionError) && (
        <p className="border-b p-3 text-sm text-destructive" role="alert">
          {schedule.actionError ?? todoState.actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
        <span className="w-16 shrink-0 text-muted-foreground">Imorgon</span>
        {tomorrowShift.kind !== 'none' && <ShiftBadge shift={tomorrowShift} />}
        {tomorrowCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {tomorrowCount} {tomorrowCount === 1 ? 'sak' : 'saker'} inplanerat
          </span>
        )}
      </div>

      <div className="p-2">
        <Link
          to="/schema"
          className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 w-full lg:h-8')}
        >
          Öppna schemat
        </Link>
      </div>
    </Panel>
  )
}
