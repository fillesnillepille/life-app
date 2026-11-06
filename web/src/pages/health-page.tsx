import { useState } from 'react'
import { LoadError, Loading } from '@/components/load-status'
import {
  AverageChart,
  CategoryBarsChart,
  CategoryTrendChart,
  MoodCalendar,
} from '@/components/rating-charts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  averageOf,
  dailyRows,
  formatAverage,
  moodOf,
  promptHour,
  type DayRating,
} from '@/lib/day-rating'
import { addDays, daysBetween, relativeDay, todayKey } from '@/lib/schedule'
import { useDayRatings } from '@/lib/use-day-ratings'
import { useNow } from '@/lib/use-now'

type Range = '30' | '90' | 'all'

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: React.ReactNode
  detail: string
}) {
  return (
    <div className="min-w-0 p-3">
      <dt className="truncate text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2 truncate text-lg font-semibold tabular-nums sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</dd>
    </div>
  )
}

function AverageValue({ ratings }: { ratings: DayRating[] }) {
  const average = mean(ratings.map(averageOf))
  if (average === null) return <>–</>
  const mood = moodOf(average)
  return (
    <>
      <mood.icon className="size-5 shrink-0" aria-label={mood.label} />
      {formatAverage(average)}
    </>
  )
}

export function HealthPage() {
  const { ratings, loadError, retry } = useDayRatings()
  const now = useNow()
  const today = todayKey(now)
  const [range, setRange] = useState<Range>('30')

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Hälsa</h1>
        {ratings && ratings.length > 0 && (
          <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
            <TabsList className="h-11 lg:h-9">
              <TabsTrigger value="30" className="px-3">
                30 dagar
              </TabsTrigger>
              <TabsTrigger value="90" className="px-3">
                90 dagar
              </TabsTrigger>
              <TabsTrigger value="all" className="px-3">
                Allt
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      {loadError && !ratings && (
        <div className="rounded-xl border">
          <LoadError message={loadError} onRetry={retry} />
        </div>
      )}
      {!ratings && !loadError && <Loading>Hämtar dagsbetygen…</Loading>}

      {ratings && ratings.length === 0 && (
        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          Inga dagsbetyg än. Från klockan {promptHour} frågar Idag hur dagen var,
          och sedan syns det här.
        </p>
      )}

      {ratings && ratings.length > 0 && (
        <Overview ratings={ratings} today={today} range={range} />
      )}
    </section>
  )
}

function Overview({
  ratings,
  today,
  range,
}: {
  ratings: DayRating[]
  today: string
  range: Range
}) {
  const from =
    range === 'all'
      ? ratings[0].date < today
        ? ratings[0].date
        : addDays(today, -6)
      : addDays(today, -(Number(range) - 1))
  const inRange = ratings.filter((rating) => rating.date >= from && rating.date <= today)
  const lastWeek = ratings.filter((rating) => rating.date > addDays(today, -7))
  const periodDays = daysBetween(from, today) + 1
  const rows = dailyRows(ratings, from, today, (rating) => averageOf(rating))
  const latest = ratings.at(-1)

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card">
        <Stat
          label="Senaste veckan"
          value={<AverageValue ratings={lastWeek} />}
          detail={`${lastWeek.length} av 7 dagar`}
        />
        <Stat
          label="Perioden"
          value={<AverageValue ratings={inRange} />}
          detail={`${inRange.length} av ${periodDays} dagar`}
        />
        <Stat
          label="Senast"
          value={<AverageValue ratings={latest ? [latest] : []} />}
          detail={latest ? relativeDay(latest.date, today) : ''}
        />
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AverageChart rows={rows} />
        </div>
        <CategoryBarsChart ratings={inRange} />
        <div className="min-w-0 lg:col-span-2">
          <CategoryTrendChart ratings={ratings} from={from} to={today} />
        </div>
        <MoodCalendar ratings={ratings} today={today} />
      </div>
    </div>
  )
}
