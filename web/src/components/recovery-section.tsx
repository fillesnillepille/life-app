import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { Panel } from '@/components/panel'
import { Stat } from '@/components/stat'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  formatDuration,
  formatNumber,
  hrvStatusLabel,
  type GarminDay,
} from '@/lib/garmin'
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatLongDay,
  relativeDay,
} from '@/lib/schedule'

const color = 'var(--sleep)'
const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const
const chartClass = 'aspect-auto h-56 w-full px-2 pt-3 pb-1'
const decimal1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 })

type Metric = {
  key: string
  label: string
  // null when the day has no value.
  pick: (day: GarminDay) => number | null
  format: (value: number) => string
  // Steps read better as bars, the others as a trend.
  bars?: boolean
}

const orNull = (value: number) => (value > 0 ? value : null)

const metrics: Metric[] = [
  {
    key: 'sleepScore',
    label: 'Sömnpoäng',
    pick: (day) => orNull(day.sleepScore),
    format: (value) => formatNumber(value),
  },
  {
    key: 'hrv',
    label: 'HRV i natt',
    pick: (day) => orNull(day.hrvLastNight),
    format: (value) => `${formatNumber(value)} ms`,
  },
  {
    key: 'restingHr',
    label: 'Vilopuls',
    pick: (day) => orNull(day.restingHr),
    format: (value) => `${formatNumber(value)} slag/min`,
  },
  {
    key: 'steps',
    label: 'Steg',
    pick: (day) => orNull(day.steps),
    format: (value) => formatNumber(value),
    bars: true,
  },
  {
    key: 'stress',
    label: 'Stress, snitt',
    pick: (day) => orNull(day.stress),
    format: (value) => formatNumber(value),
  },
  {
    key: 'bodyBattery',
    label: 'Body Battery, högsta',
    pick: (day) => orNull(day.bodyBatteryHigh),
    format: (value) => formatNumber(value),
  },
]

type Row = { date: string; value: number | null; rolling: number | null; day?: GarminDay }

// One row per date from `from` to `to`, with the value and the average of
// the days with a value in the 7 days up to it.
function rowsOf(
  days: GarminDay[],
  from: string,
  to: string,
  pick: (day: GarminDay) => number | null,
): Row[] {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const values: (number | null)[] = []
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, index) => {
    const date = addDays(from, index)
    const day = byDate.get(date)
    const value = day ? pick(day) : null
    values.push(value)
    const window = values.slice(-7).filter((item): item is number => item !== null)
    return {
      date,
      value,
      day,
      rolling: window.length ? window.reduce((sum, item) => sum + item, 0) / window.length : null,
    }
  })
}

// Sleep, HRV, resting heart rate, and steps in Hälsa.
export function RecoverySection({
  days,
  from,
  today,
}: {
  days: GarminDay[]
  from: string
  today: string
}) {
  const latestWith = (pick: (day: GarminDay) => number) =>
    [...days].reverse().find((day) => pick(day) > 0)
  const sleepDay = latestWith((day) => day.sleep)
  const hrvDay = latestWith((day) => day.hrvLastNight)
  const heartDay = latestWith((day) => day.restingHr)
  const todayDay = days.find((day) => day.date === today)
  const when = (day?: GarminDay) => (day ? relativeDay(day.date, today) : '')

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-4 sm:divide-y-0">
        <Stat
          label="Sömn"
          value={sleepDay ? formatDuration(sleepDay.sleep) : '–'}
          detail={
            sleepDay
              ? `${when(sleepDay)}${sleepDay.sleepScore ? `, poäng ${sleepDay.sleepScore}` : ''}`
              : ''
          }
        />
        <Stat
          label="HRV"
          value={hrvDay ? `${hrvDay.hrvLastNight} ms` : '–'}
          detail={
            hrvDay
              ? [when(hrvDay), hrvStatusLabel(hrvDay.hrvStatus)].filter(Boolean).join(', ')
              : ''
          }
        />
        <Stat
          label="Vilopuls"
          value={heartDay ? `${heartDay.restingHr}` : '–'}
          detail={heartDay ? `slag/min, ${when(heartDay).toLowerCase()}` : ''}
        />
        <Stat
          label="Steg idag"
          value={todayDay?.steps ? formatNumber(todayDay.steps) : '–'}
          detail={todayDay?.stepsGoal ? `mål ${formatNumber(todayDay.stepsGoal)}` : ''}
        />
      </dl>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SleepChart days={days} from={from} to={today} />
        <MetricChart days={days} from={from} to={today} />
      </div>
    </div>
  )
}

// Hours asleep per night as bars, with the 7-day average as a line.
function SleepChart({ days, from, to }: { days: GarminDay[]; from: string; to: string }) {
  const rows = rowsOf(days, from, to, (day) => (day.sleep ? day.sleep / 3600 : null))
  const config = {
    value: { label: 'Sömn', color },
    rolling: { label: 'Snitt 7 nätter', color },
  } satisfies ChartConfig

  return (
    <Panel title="Sömn" meta="Timmar per natt, linje snitt 7 nätter">
      <ChartContainer config={config} className={chartClass}>
        <ComposedChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            {...axisProps}
            minTickGap={24}
            tickFormatter={(value: string) => formatDayMonth(value)}
          />
          <YAxis
            {...axisProps}
            width={32}
            domain={[0, (max: number) => Math.max(9, Math.ceil(max))]}
            allowDecimals={false}
            tickFormatter={(value: number) => `${value} h`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload?.[0]?.payload?.date
                  return typeof date === 'string' ? formatLongDay(date) : ''
                }}
                formatter={(value, name, item) => {
                  const day = (item.payload as Row).day
                  if (name === 'rolling') {
                    return `Snitt 7 nätter: ${formatDuration(Number(value) * 3600)}`
                  }
                  const parts = [formatDuration(Number(value) * 3600)]
                  if (day?.sleepStart && day.sleepEnd) parts.push(`${day.sleepStart}–${day.sleepEnd}`)
                  if (day?.sleepScore) parts.push(`poäng ${day.sleepScore}`)
                  return parts.join(', ')
                }}
              />
            }
          />
          <Bar dataKey="value" fill={color} fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Line
            dataKey="rolling"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ChartContainer>
    </Panel>
  )
}

// One measure over time, picked from a list.
function MetricChart({ days, from, to }: { days: GarminDay[]; from: string; to: string }) {
  const [key, setKey] = useState('hrv')
  const metric = metrics.find((item) => item.key === key) ?? metrics[0]
  const rows = rowsOf(days, from, to, metric.pick)
  const config = {
    value: { label: metric.label, color },
    rolling: { label: 'Snitt 7 dagar', color },
  } satisfies ChartConfig
  const withValue = rows.filter((row) => row.value !== null).length

  return (
    <Panel title="Återhämtning">
      <div className="border-b p-2">
        <NativeSelect
          aria-label="Mått"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="[&_select]:h-11 lg:[&_select]:h-8"
        >
          {metrics.map((item) => (
            <NativeSelectOption key={item.key} value={item.key}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <ChartContainer config={config} className={chartClass}>
        <ComposedChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            {...axisProps}
            minTickGap={24}
            tickFormatter={(value: string) => formatDayMonth(value)}
          />
          <YAxis
            {...axisProps}
            width={44}
            domain={metric.bars ? [0, 'auto'] : ['auto', 'auto']}
            tickFormatter={(value: number) =>
              value >= 10_000 ? `${decimal1.format(value / 1000)}k` : formatNumber(value)
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload?.[0]?.payload?.date
                  return typeof date === 'string' ? formatLongDay(date) : ''
                }}
                formatter={(value, name) =>
                  `${name === 'rolling' ? 'Snitt 7 dagar' : metric.label}: ${metric.format(Math.round(Number(value)))}`
                }
              />
            }
          />
          {metric.bars ? (
            <Bar dataKey="value" fill={color} fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={18} />
          ) : (
            <Line
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
              dot={{ r: 3, fill: color, fillOpacity: 0.45, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, stroke: 'var(--background)', strokeWidth: 2 }}
            />
          )}
          <Line
            dataKey="rolling"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            connectNulls
            dot={withValue === 1 ? { r: 4 } : false}
          />
        </ComposedChart>
      </ChartContainer>
    </Panel>
  )
}
