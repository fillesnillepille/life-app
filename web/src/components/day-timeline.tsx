import { Checkbox } from '@/components/ui/checkbox'
import {
  blocksFor,
  crossesMidnight,
  entryView,
  layoutLanes,
  timeRange,
  type DayShift,
  type ScheduleEntry,
  shiftStyle,
} from '@/lib/schedule'
import type { Todo } from '@/lib/use-todos'
import { cn } from '@/lib/utils'

const hours = Array.from({ length: 24 }, (_, hour) => hour)

// The hour labels down the side, lined up with DayTimeline's grid.
export function HourGutter({ hourHeight }: { hourHeight: number }) {
  return (
    <div
      className="relative w-11 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums"
      style={{ height: hourHeight * 24 }}
      aria-hidden
    >
      {hours.slice(1).map((hour) => (
        <span
          key={hour}
          className="absolute right-2 -translate-y-1/2"
          style={{ top: hour * hourHeight }}
        >
          {String(hour).padStart(2, '0')}:00
        </span>
      ))}
    </div>
  )
}

type Placed = {
  key: string
  from: number
  to: number
  entry: ScheduleEntry
  fromYesterday: boolean
  pastMidnight: boolean
}

// One day as a column of hours: the shift as a coloured strip on the left and
// entries as blocks at their times, side by side where they overlap.
export function DayTimeline({
  shift,
  yesterdayShift,
  entries,
  spilled,
  todos,
  hourHeight,
  nowMinutes,
  compact,
  onOpenEntry,
  onToggleEntry,
}: {
  shift: DayShift
  yesterdayShift: DayShift
  // The day's timed entries.
  entries: ScheduleEntry[]
  // Timed entries from the day before that run past midnight.
  spilled: ScheduleEntry[]
  todos: Todo[]
  hourHeight: number
  // Minutes since midnight when the day is today, to draw a "now" line.
  nowMinutes?: number
  // The narrow week columns: a thin shift strip and titles only.
  compact?: boolean
  onOpenEntry: (entry: ScheduleEntry) => void
  onToggleEntry: (entry: ScheduleEntry) => void
}) {
  const bands: {
    key: string
    from: number
    to: number
    shift: Extract<DayShift, { kind: 'shift' }>
    fromYesterday: boolean
  }[] = []
  if (yesterdayShift.kind === 'shift') {
    const spill = blocksFor(yesterdayShift.type.start, yesterdayShift.type.end).spill
    if (spill) bands.push({ key: 'yesterday', ...spill, shift: yesterdayShift, fromYesterday: true })
  }
  if (shift.kind === 'shift') {
    const { today } = blocksFor(shift.type.start, shift.type.end)
    bands.push({ key: 'today', from: today.from, to: today.to, shift, fromYesterday: false })
  }

  const blocks: Placed[] = [
    ...spilled.flatMap((entry) => {
      const spill = blocksFor(entry.start, entry.end).spill
      return spill
        ? [{ key: `${entry.id}-spill`, ...spill, entry, fromYesterday: true, pastMidnight: false }]
        : []
    }),
    ...entries.map((entry) => {
      const { today } = blocksFor(entry.start, entry.end)
      return {
        key: entry.id,
        from: today.from,
        to: today.to,
        entry,
        fromYesterday: false,
        pastMidnight: crossesMidnight(entry.start, entry.end),
      }
    }),
  ]
  const placed = layoutLanes(blocks)
  const top = (minutes: number) => (minutes / 60) * hourHeight
  const stripWidth = compact ? 6 : 88

  return (
    <div className="relative flex-1" style={{ height: hourHeight * 24 }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: hour * hourHeight }}
          aria-hidden
        />
      ))}

      {bands.map((band) => (
        <div
          key={band.key}
          className="absolute left-0 overflow-hidden rounded-r-md border-l-[3px] px-1.5 py-1 text-xs"
          style={{
            ...shiftStyle(band.shift.type.color),
            top: top(band.from),
            height: top(band.to - band.from),
            width: stripWidth,
          }}
          title={`${band.shift.type.name} ${timeRange(band.shift.type.start, band.shift.type.end)}`}
        >
          {!compact && (
            <>
              <p className="truncate font-medium">{band.shift.type.name}</p>
              <p className="truncate text-muted-foreground tabular-nums">
                {band.fromYesterday
                  ? `till ${band.shift.type.end}`
                  : timeRange(band.shift.type.start, band.shift.type.end)}
              </p>
            </>
          )}
        </div>
      ))}

      <div
        className="absolute inset-y-0 right-0"
        style={{ left: stripWidth + (compact ? 2 : 6) }}
      >
        {placed.map(({ block, lane, lanes }) => {
          const view = entryView(block.entry, todos)
          const height = Math.max(top(block.to - block.from), compact ? 18 : 24)
          const time = block.fromYesterday
            ? `från igår–${block.entry.end}`
            : timeRange(block.entry.start, block.entry.end)
          return (
            <div
              key={block.key}
              className={cn(
                'absolute flex overflow-hidden rounded-md border bg-card text-xs',
                view.done && 'opacity-60',
              )}
              style={{
                top: top(block.from),
                height,
                left: `calc(${(lane / lanes) * 100}% + 1px)`,
                width: `calc(${100 / lanes}% - 2px)`,
              }}
            >
              {!compact && (
                <span className="flex shrink-0 items-start py-1 pl-1.5">
                  <Checkbox
                    checked={view.done}
                    onCheckedChange={() => onToggleEntry(block.entry)}
                    aria-label={`${view.done ? 'Markera som inte klar' : 'Markera som klar'}: ${view.title}`}
                  />
                </span>
              )}
              <button
                type="button"
                onClick={() => onOpenEntry(block.entry)}
                className="min-w-0 flex-1 px-1.5 py-0.5 text-left hover:bg-accent/60"
                aria-label={`${view.title}, ${time}. Ändra`}
              >
                <span
                  className={cn(
                    'block truncate font-medium',
                    view.done && 'line-through',
                  )}
                >
                  {view.title}
                </span>
                {!compact && height >= 36 && (
                  <span className="block truncate text-muted-foreground tabular-nums">
                    {time}
                    {block.pastMidnight && ' (till imorgon)'}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {nowMinutes !== undefined && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary"
          style={{ top: top(nowMinutes) }}
          aria-hidden
        >
          <span className="absolute -top-1 -left-1 size-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  )
}
