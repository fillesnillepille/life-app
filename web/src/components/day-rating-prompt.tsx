import { useState } from 'react'
import { X } from 'lucide-react'
import { MoodIcon } from '@/components/mood-icon'
import { Panel } from '@/components/panel'
import { RatingForm } from '@/components/rating-form'
import { Button } from '@/components/ui/button'
import { dayToPrompt, moodOf, averageOf, type DayRating } from '@/lib/day-rating'
import { formatShortDay, isWorkDay, shiftOn, todayKey } from '@/lib/schedule'
import { useDayRatings } from '@/lib/use-day-ratings'
import type { Schedule } from '@/lib/use-schedule'

// "Hur var dagen?" on Idag: today's grades from the evening, or yesterday's if
// they were missed. Shows nothing until both the grades and the schedule are
// loaded, so a slow or failed load never clutters the page.
export function DayRatingPrompt({
  schedule,
  now,
}: {
  schedule: Schedule
  now: number
}) {
  const { ratings, save } = useDayRatings()
  const [justSaved, setJustSaved] = useState<DayRating | null>(null)

  if (!ratings || !schedule.data) return null
  const date = dayToPrompt(new Set(ratings.map((item) => item.date)), now)
  const today = todayKey(now)

  if (!date) {
    if (!justSaved) return null
    return (
      <section
        className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm"
        role="status"
      >
        <MoodIcon rating={justSaved} showAverage />
        <span className="flex-1">
          Sparat. {moodOf(averageOf(justSaved)).label}. Du kan ändra betyget i
          Schema {justSaved.date === today ? 'till och med imorgon' : 'idag'}.
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 lg:size-8"
          aria-label="Stäng"
          onClick={() => setJustSaved(null)}
        >
          <X aria-hidden />
        </Button>
      </section>
    )
  }

  const isToday = date === today
  return (
    <Panel
      title="Hur var dagen?"
      meta={isToday ? 'Idag' : `Igår, ${formatShortDay(date)}`}
      accent
    >
      <div className="p-3">
        <RatingForm
          key={date}
          workDay={isWorkDay(shiftOn(date, schedule.data))}
          dayWord={isToday ? 'idag' : 'igår'}
          onSave={async (values) => setJustSaved(await save(date, values))}
        />
      </div>
    </Panel>
  )
}
