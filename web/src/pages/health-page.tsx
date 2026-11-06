import { useState, type ReactNode } from 'react'
import { GarminSyncBar } from '@/components/garmin-status'
import { HealthInsights } from '@/components/health-insights'
import { LoadError, Loading } from '@/components/load-status'
import {
  AverageChart,
  CategoryBarsChart,
  CategoryTrendChart,
  MoodCalendar,
} from '@/components/rating-charts'
import { RecoverySection } from '@/components/recovery-section'
import { Stat } from '@/components/stat'
import { TrainingSection } from '@/components/training-section'
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
import { useGarminActivities, useGarminDays, useGarminStatus } from '@/lib/use-garmin'
import { useNow } from '@/lib/use-now'

type Range = '30' | '90' | 'all'

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function HealthPage() {
  const { ratings, loadError, retry } = useDayRatings()
  const { activities, loadError: activitiesError, retry: retryActivities } = useGarminActivities()
  const { days, loadError: daysError, retry: retryDays } = useGarminDays()
  const garmin = useGarminStatus()
  const now = useNow()
  const today = todayKey(now)
  const [range, setRange] = useState<Range>('30')

  const hasGarmin = (activities?.length ?? 0) + (days?.length ?? 0) > 0
  const hasAny = (ratings?.length ?? 0) > 0 || hasGarmin
  // The Garmin sections show once Garmin is set up or has sent anything.
  const showGarmin =
    hasGarmin || (garmin.status !== null && garmin.status.state !== 'not_configured')

  // The first date of the period. "Allt" starts at the oldest date anything
  // has, and shows at least a week.
  const oldest = [ratings?.[0]?.date, activities?.[0]?.date, days?.[0]?.date]
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const from =
    range === 'all'
      ? oldest && oldest < addDays(today, -6)
        ? oldest
        : addDays(today, -6)
      : addDays(today, -(Number(range) - 1))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Hälsa</h1>
        {hasAny && (
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

      <Section title="Dagsbetyg">
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
          <Overview ratings={ratings} today={today} from={from} />
        )}
      </Section>

      <GarminSyncBar state={garmin} today={today} />

      {garmin.status?.state === 'not_configured' && !hasGarmin && (
        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          Garmin är inte kopplat än. När API-nyckeln finns i tjänsten syns
          träning, sömn och återhämtning här.
        </p>
      )}

      {showGarmin && (
        <>
          <Section title="Träning">
            {activitiesError && !activities && (
              <div className="rounded-xl border">
                <LoadError message={activitiesError} onRetry={retryActivities} />
              </div>
            )}
            {!activities && !activitiesError && <Loading>Hämtar träningspassen…</Loading>}
            {activities && <TrainingSection activities={activities} from={from} today={today} />}
          </Section>

          <Section title="Sömn och återhämtning">
            {daysError && !days && (
              <div className="rounded-xl border">
                <LoadError message={daysError} onRetry={retryDays} />
              </div>
            )}
            {!days && !daysError && <Loading>Hämtar sömn och återhämtning…</Loading>}
            {days && days.length === 0 && (
              <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                Ingen sömn- eller hälsodata från Garmin än.
              </p>
            )}
            {days && days.length > 0 && <RecoverySection days={days} from={from} today={today} />}
          </Section>

          {ratings && activities && days && ratings.length > 0 && hasGarmin && (
            <Section title="Samband">
              <HealthInsights
                ratings={ratings.filter((rating) => rating.date >= from && rating.date <= today)}
                activities={activities}
                days={days}
              />
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Overview({
  ratings,
  today,
  from,
}: {
  ratings: DayRating[]
  today: string
  from: string
}) {
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
