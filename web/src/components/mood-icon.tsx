import { averageOf, formatAverage, moodOf, type DayRating } from '@/lib/day-rating'
import { cn } from '@/lib/utils'

// The smiley for a graded day, with the average in its label.
export function MoodIcon({
  rating,
  showAverage,
  className,
}: {
  rating: DayRating
  // Writes the average next to the smiley.
  showAverage?: boolean
  className?: string
}) {
  const average = averageOf(rating)
  const mood = moodOf(average)
  const label = `${mood.label}, snitt ${formatAverage(average)}`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-flex shrink-0 items-center gap-1', className)}
    >
      <mood.icon className="size-4" aria-hidden />
      {showAverage && (
        <span className="text-xs text-muted-foreground tabular-nums" aria-hidden>
          {formatAverage(average)}
        </span>
      )}
    </span>
  )
}
