import {
  shiftLabel,
  shiftStyle,
  timeRange,
  type DayShift,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'

// The day's shift as a small chip: "Dag 07:00–16:00", or "Ledig".
export function ShiftBadge({
  shift,
  showTimes = true,
  className,
}: {
  shift: DayShift
  showTimes?: boolean
  className?: string
}) {
  if (shift.kind === 'none') return null
  const changed = shift.override ? ' (ändrad)' : ''
  if (shift.kind !== 'shift') {
    return (
      <span
        className={cn(
          'inline-flex min-w-0 items-center rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">
          {shiftLabel(shift)}
          {changed}
        </span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-md border border-l-[3px] px-1.5 py-0.5 text-xs',
        className,
      )}
      style={shiftStyle(shift.type.color)}
    >
      <span className="truncate font-medium">
        {shift.type.name}
        {changed}
      </span>
      {showTimes && (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {timeRange(shift.type.start, shift.type.end)}
        </span>
      )}
    </span>
  )
}
