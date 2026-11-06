import { useState } from 'react'
import { Link } from 'react-router'
import { Heart } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Panel } from '@/components/panel'
import { SportIcon } from '@/components/sport-icon'
import { Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  activityTitle,
  formatDistance,
  formatDuration,
  formatHours,
  formatPace,
  isTraining,
  periodRows,
  sportLabel,
  sportRows,
  totalsOf,
  type Activity,
} from '@/lib/garmin'
import { mondayOf, relativeDay } from '@/lib/schedule'

const color = 'var(--activity)'
const chartConfig = { hours: { label: 'Träningstid', color } } satisfies ChartConfig
const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const
const hoursFormat = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 })

const passCount = (count: number) => `${count} pass`

// Training in Hälsa: the week and the period in figures, time per week or
// month, each sport's totals, and the activities themselves.
export function TrainingSection({
  activities,
  from,
  today,
}: {
  activities: Activity[]
  from: string
  today: string
}) {
  const inRange = activities.filter(
    (activity) => activity.date >= from && activity.date <= today,
  )
  // Breathing and meditation are listed, but left out of the sums.
  const training = inRange.filter(isTraining)
  const thisWeek = totalsOf(
    activities.filter((activity) => activity.date >= mondayOf(today) && isTraining(activity)),
  )
  const period = totalsOf(training)

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card">
        <Stat
          label="Veckan"
          value={formatDuration(thisWeek.seconds)}
          detail={passCount(thisWeek.count)}
        />
        <Stat
          label="Perioden"
          value={formatDuration(period.seconds)}
          detail={passCount(period.count)}
        />
        <Stat
          label="Distans"
          value={period.distance ? formatDistance(period.distance) : '–'}
          detail="under perioden"
        />
      </dl>

      {inRange.length === 0 ? (
        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          Inga träningspass under perioden.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <TimeChart activities={training} from={from} to={today} />
          </div>
          <SportTable activities={training} />
          <div className="min-w-0 lg:col-span-3">
            <ActivityList activities={inRange} today={today} />
          </div>
        </div>
      )}
    </div>
  )
}

// Training time per week or month, as bars.
function TimeChart({
  activities,
  from,
  to,
}: {
  activities: Activity[]
  from: string
  to: string
}) {
  const [by, setBy] = useState<'week' | 'month'>('week')
  const rows = periodRows(activities, from, to, by)

  return (
    <Panel title="Träningstid" meta={by === 'week' ? 'Per vecka' : 'Per månad'}>
      <div className="border-b p-2">
        <Tabs value={by} onValueChange={(value) => setBy(value as 'week' | 'month')}>
          <TabsList className="h-11 lg:h-8">
            <TabsTrigger value="week" className="px-3">
              Vecka
            </TabsTrigger>
            <TabsTrigger value="month" className="px-3">
              Månad
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full px-2 pt-3 pb-1">
        <BarChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={12} />
          <YAxis
            {...axisProps}
            width={32}
            allowDecimals={false}
            tickFormatter={(value: number) => `${hoursFormat.format(value)} h`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                formatter={(value, _name, item) =>
                  `${formatHours(Number(value) * 3600)}, ${passCount(item.payload?.count ?? 0)}`
                }
              />
            }
          />
          <Bar dataKey="hours" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartContainer>
    </Panel>
  )
}

// Each sport's count, time, and distance over the period.
function SportTable({ activities }: { activities: Activity[] }) {
  const rows = sportRows(activities)
  return (
    <Panel title="Per sport" meta="Under perioden">
      {rows.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">Ingen träning under perioden.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3 p-3 text-sm">
              <SportIcon type={row.type} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{row.label}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {[passCount(row.count), row.distance ? formatDistance(row.distance) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {formatDuration(row.seconds)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const LIST_LENGTH = 8

// The period's activities, newest first. Each opens its day in Schema.
function ActivityList({ activities, today }: { activities: Activity[]; today: string }) {
  const [all, setAll] = useState(false)
  const newest = [...activities].sort((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
  )
  const shown = all ? newest : newest.slice(0, LIST_LENGTH)

  return (
    <Panel title="Pass" meta={passCount(activities.length)}>
      <ul className="divide-y">
        {shown.map((activity) => {
          const pace = formatPace(activity)
          const when = `${relativeDay(activity.date, today)}${activity.startTime ? ` ${activity.startTime}` : ''}`
          return (
            <li key={activity.id}>
              <Link
                to={`/schema?vy=dag&datum=${activity.date}`}
                className="flex items-center gap-3 p-3 hover:bg-accent/40"
                aria-label={`${activityTitle(activity)}, ${sportLabel(activity.type)}, ${when}, ${formatDuration(activity.duration)}. Öppna dagen i Schema`}
              >
                <SportIcon type={activity.type} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {activityTitle(activity)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {sportLabel(activity.type)} · {when}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="block">{formatDuration(activity.duration)}</span>
                  <span className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    {activity.distance > 0 && <span>{formatDistance(activity.distance)}</span>}
                    {pace && <span className="hidden sm:inline">{pace}</span>}
                    {activity.averageHr > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="size-3" aria-hidden />
                        {activity.averageHr}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {newest.length > LIST_LENGTH && (
        <div className="border-t p-2">
          <Button variant="ghost" className="h-11 w-full lg:h-8" onClick={() => setAll(!all)}>
            {all ? 'Visa färre' : `Visa alla ${newest.length}`}
          </Button>
        </div>
      )}
    </Panel>
  )
}
