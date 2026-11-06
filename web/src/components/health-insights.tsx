import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { Panel } from '@/components/panel'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { averageOf, formatAverage, type DayRating } from '@/lib/day-rating'
import { isTraining, type Activity, type GarminDay } from '@/lib/garmin'

const color = 'var(--rating)'
const chartConfig = { value: { label: 'Snittbetyg', color } } satisfies ChartConfig
const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const

type Group = { label: string; value: number; days: number }

function groupsOf(
  ratings: DayRating[],
  labels: string[],
  groupOf: (rating: DayRating) => string | null,
): Group[] {
  return labels
    .map((label) => {
      const values = ratings
        .filter((rating) => groupOf(rating) === label)
        .map((rating) => averageOf(rating))
      return {
        label,
        value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
        days: values.length,
      }
    })
    .filter((group) => group.days > 0)
}

const sleepGroups = ['Under 6 h', '6–7 h', '7–8 h', '8 h eller mer']

function sleepGroup(seconds: number) {
  const hours = seconds / 3600
  if (hours < 6) return sleepGroups[0]
  if (hours < 7) return sleepGroups[1]
  if (hours < 8) return sleepGroups[2]
  return sleepGroups[3]
}

// How the day grades compare on training and rest days, and after short
// and long nights. Only days Garmin has data for count, so days before the
// watch was worn don't pass for rest days.
export function HealthInsights({
  ratings,
  activities,
  days,
}: {
  ratings: DayRating[]
  activities: Activity[]
  days: GarminDay[]
}) {
  const trained = new Set(activities.filter(isTraining).map((activity) => activity.date))
  const byDate = new Map(days.map((day) => [day.date, day]))
  const covered = ratings.filter((rating) => trained.has(rating.date) || byDate.has(rating.date))

  const training = groupsOf(covered, ['Träningsdagar', 'Vilodagar'], (rating) =>
    trained.has(rating.date) ? 'Träningsdagar' : 'Vilodagar',
  )
  const sleep = groupsOf(covered, sleepGroups, (rating) => {
    const night = byDate.get(rating.date)?.sleep
    return night ? sleepGroup(night) : null
  })

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <GroupChart
        title="Betyg och träning"
        groups={training}
        empty="Betygsätt några dagar med och utan träning, så syns skillnaden här."
      />
      <GroupChart
        title="Betyg och sömn"
        meta="Efter nattens sömn"
        groups={sleep}
        empty="Betygsätt några dagar med sömndata, så syns skillnaden här."
      />
    </div>
  )
}

function GroupChart({
  title,
  meta,
  groups,
  empty,
}: {
  title: string
  meta?: string
  groups: Group[]
  empty: string
}) {
  const total = groups.reduce((sum, group) => sum + group.days, 0)
  return (
    <Panel title={title} meta={meta ?? 'Snittbetyg för perioden'}>
      {groups.length < 2 ? (
        <p className="p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full px-2 pt-3 pb-1"
            style={{ height: 40 + groups.length * 40 }}
          >
            <BarChart data={groups} layout="vertical" accessibilityLayer margin={{ right: 32 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" {...axisProps} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <YAxis type="category" dataKey="label" {...axisProps} width={104} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(value, _name, item) =>
                      `${formatAverage(Number(value))} (${item.payload?.days} ${
                        item.payload?.days === 1 ? 'dag' : 'dagar'
                      })`
                    }
                  />
                }
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList
                  dataKey="value"
                  position="right"
                  className="fill-foreground tabular-nums"
                  fontSize={12}
                  formatter={(value: unknown) => formatAverage(Number(value))}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Bygger på {total} {total === 1 ? 'betygsatt dag' : 'betygsatta dagar'}. Få dagar
            ger osäkra skillnader.
          </p>
        </>
      )}
    </Panel>
  )
}
