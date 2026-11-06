import type { CSSProperties } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { SportIcon } from '@/components/sport-icon'
import type { TimelineActivity } from '@/lib/garmin'
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

type Placed = { key: string; from: number; to: number } & (
  | { kind: 'entry'; entry: ScheduleEntry; fromYesterday: boolean; pastMidnight: boolean }
  | { kind: 'activity'; activity: TimelineActivity }
)

// One day as a column of hours: the shift as a coloured strip on the left,
// and entries and Garmin activities as blocks at their times, side by side
// where they overlap.
export function DayTimeline({
  shift,
  yesterdayShift,
  entries,
  spilled,
  activities = [],
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
  // The day's activities from Garmin, which can't be changed here.
  activities?: TimelineActivity[]
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
        ? [{ key: `${entry.id}-spill`, ...spill, kind: 'entry' as const, entry, fromYesterday: true, pastMidnight: false }]
        : []
    }),
    ...entries.map((entry) => {
      const { today } = blocksFor(entry.start, entry.end)
      return {
        key: entry.id,
        from: today.from,
        to: today.to,
        kind: 'entry' as const,
        entry,
        fromYesterday: false,
        pastMidnight: crossesMidnight(entry.start, entry.end),
      }
    }),
    ...activities.map((activity) => {
      const { today } = blocksFor(activity.start, activity.end)
      return {
        key: `activity-${activity.id}`,
        from: today.from,
        to: today.to,
        kind: 'activity' as const,
        activity,
      }
    }),
  ]
  const placed = layoutLanes(blocks)
  const top = (minutes: number) => (minutes / 60) * hourHeight
  // In the narrow week columns the shift is a thin strip at the left. In the
  // day view it fills the width, behind the entries.
  const stripWidth = 6

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
          className={cn(
            'absolute left-0 border-l-[3px]',
            compact ? 'rounded-r-md' : 'right-0 rounded-md',
          )}
          style={{
            ...shiftStyle(band.shift.type.color),
            top: top(band.from),
            height: top(band.to - band.from),
            width: compact ? stripWidth : undefined,
          }}
          title={`${band.shift.type.name} ${timeRange(band.shift.type.start, band.shift.type.end)}`}
        />
      ))}

      <div
        className="absolute inset-y-0 right-0"
        style={{ left: compact ? stripWidth + 2 : 6 }}
      >
        {placed.map(({ block, lane, lanes }) => {
          const height = Math.max(top(block.to - block.from), compact ? 18 : 24)
          const position = {
            top: top(block.from),
            height,
            left: `calc(${(lane / lanes) * 100}% + 1px)`,
            width: `calc(${100 / lanes}% - 2px)`,
          }
          if (block.kind === 'activity') {
            return (
              <ActivityBlock
                key={block.key}
                activity={block.activity}
                style={position}
                height={height}
                compact={compact}
              />
            )
          }
          const view = entryView(block.entry, todos)
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
              style={position}
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

      {/* The shift's name and times, in the band's bottom right corner and
          above the entries. Entries usually start with the shift, so the
          bottom is where they least often sit. */}
      {!compact &&
        bands.map((band) => (
          <p
            key={`${band.key}-label`}
            className="pointer-events-none absolute right-1.5 z-10 rounded-md border bg-background/90 px-1.5 py-0.5 text-xs"
            style={{ top: Math.max(top(band.from) + 4, top(band.to) - 28), borderColor: shiftStyle(band.shift.type.color).borderColor }}
          >
            <span className="font-medium">{band.shift.type.name}</span>{' '}
            <span className="text-muted-foreground tabular-nums">
              {band.fromYesterday
                ? `till ${band.shift.type.end}`
                : timeRange(band.shift.type.start, band.shift.type.end)}
            </span>
          </p>
        ))}

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

// A Garmin activity on the timeline: orange, with the sport's icon so the
// colour isn't the only cue. It comes from Garmin, so it can't be ticked or
// changed here.
function ActivityBlock({
  activity,
  style,
  height,
  compact,
}: {
  activity: TimelineActivity
  style: CSSProperties
  height: number
  compact?: boolean
}) {
  const time = timeRange(activity.start, activity.end)
  return (
    <div
      className="absolute flex gap-1.5 overflow-hidden rounded-md border border-l-[3px] px-1.5 py-0.5 text-xs"
      style={{
        ...style,
        borderColor: 'color-mix(in oklab, var(--activity) 45%, transparent)',
        borderLeftColor: 'var(--activity)',
        background: 'color-mix(in oklab, var(--activity) 16%, var(--card))',
      }}
      title={`${activity.title}, ${time}. ${activity.detail}`}
    >
      <SportIcon type={activity.type} className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          <span className="sr-only">Träning från Garmin: </span>
          {activity.title}
        </span>
        {!compact && height >= 36 && (
          <span className="block truncate text-muted-foreground tabular-nums">
            {time} · {activity.detail}
          </span>
        )}
        {compact && <span className="sr-only">, {time}</span>}
      </span>
    </div>
  )
}
