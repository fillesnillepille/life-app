import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Panel } from '@/components/panel'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  averageOf,
  formatAverage,
  grades,
  moodOf,
  moods,
  dailyRows,
  type DayRating,
  type GradeKey,
  type Row,
} from '@/lib/day-rating'
import {
  addDays,
  formatDayMonth,
  formatLongDay,
  parseDateKey,
  weekdayIndex,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'

const color = 'var(--rating)'

const chartConfig = {
  average: { label: 'Dagens snitt', color },
  rolling: { label: 'Snitt 7 dagar', color },
  value: { label: 'Betyg', color },
} satisfies ChartConfig

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const

function GradeAxis() {
  return <YAxis {...axisProps} width={24} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
}

function DateAxis() {
  return (
    <XAxis
      dataKey="date"
      {...axisProps}
      minTickGap={24}
      tickFormatter={(value: string) => formatDayMonth(value)}
    />
  )
}

function Tooltip() {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          labelFormatter={(_, payload) => {
            const date = payload?.[0]?.payload?.date
            return typeof date === 'string' ? formatLongDay(date) : ''
          }}
          formatter={(value, name) => (
            <div className="flex w-full items-center gap-2">
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-[2px]',
                  name === 'value' && 'opacity-50',
                )}
                style={{ background: color }}
                aria-hidden
              />
              <span className="flex-1 text-muted-foreground">
                {name === 'rolling' ? 'Snitt 7 dagar' : 'Dagens betyg'}
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {formatAverage(Number(value))}
              </span>
            </div>
          )}
        />
      }
    />
  )
}

const chartClass = 'aspect-auto h-56 w-full px-2 pt-3 pb-1'

// A day's value as a faint dot, and the 7-day average as a line through them.
function TrendChart({ rows }: { rows: Row[] }) {
  const graded = rows.filter((row) => row.value !== null).length
  return (
    <ChartContainer config={chartConfig} className={chartClass}>
      <LineChart data={rows} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <DateAxis />
        <GradeAxis />
        <Tooltip />
        <Line
          dataKey="value"
          stroke="none"
          isAnimationActive={false}
          dot={{ r: 3, fill: color, fillOpacity: 0.45, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color, stroke: 'var(--background)', strokeWidth: 2 }}
        />
        <Line
          dataKey="rolling"
          type="monotone"
          stroke={color}
          strokeWidth={2}
          connectNulls
          dot={graded === 1 ? { r: 4 } : false}
          activeDot={{ r: 5, stroke: 'var(--background)', strokeWidth: 2 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function AverageChart({ rows }: { rows: Row[] }) {
  return (
    <Panel title="Dagsbetyg" meta="Prickar per dag, linje snitt 7 dagar">
      <TrendChart rows={rows} />
    </Panel>
  )
}

// One area over time, picked from a list.
export function CategoryTrendChart({
  ratings,
  from,
  to,
}: {
  ratings: DayRating[]
  from: string
  to: string
}) {
  const [key, setKey] = useState<GradeKey>('general')
  const rows = dailyRows(ratings, from, to, (rating) =>
    key === 'work' && !rating.worked ? null : rating[key] || null,
  )
  return (
    <Panel title="Ett område över tid">
      <div className="border-b p-2">
        <NativeSelect
          aria-label="Område"
          value={key}
          onChange={(event) => setKey(event.target.value as GradeKey)}
          className="[&_select]:h-11 lg:[&_select]:h-8"
        >
          {grades.map((grade) => (
            <NativeSelectOption key={grade.key} value={grade.key}>
              {grade.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <TrendChart rows={rows} />
    </Panel>
  )
}

// Each area's average over the period. Arbete counts only days with work.
export function CategoryBarsChart({ ratings }: { ratings: DayRating[] }) {
  const rows = grades
    .map((grade) => {
      const values = ratings
        .filter((rating) => grade.key !== 'work' || rating.worked)
        .map((rating) => rating[grade.key])
        .filter((value) => value > 0)
      return {
        label: grade.label,
        value: values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0,
        days: values.length,
      }
    })
    .filter((row) => row.days > 0)

  return (
    <Panel title="Per område" meta="Snitt för perioden">
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full px-2 pt-3 pb-1">
        <BarChart data={rows} layout="vertical" accessibilityLayer margin={{ right: 32 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axisProps} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
          <YAxis type="category" dataKey="label" {...axisProps} width={80} />
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
    </Panel>
  )
}

const monthFormat = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })
const weekdays = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

// A month as a grid, each day shaded by its smiley: the happier, the brighter.
// Tapping a day opens it in Schema.
export function MoodCalendar({
  ratings,
  today,
}: {
  ratings: DayRating[]
  today: string
}) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const first = `${month}-01`
  const firstDate = parseDateKey(first)
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate()
  const byDate = new Map(ratings.map((rating) => [rating.date, rating]))
  const shiftMonth = (by: number) => {
    const date = new Date(firstDate.getFullYear(), firstDate.getMonth() + by, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  const label = monthFormat.format(firstDate)

  return (
    <Panel title="Kalender">
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 lg:size-8"
            aria-label="Föregående månad"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <p className="text-sm font-medium first-letter:uppercase" aria-live="polite">
            {label}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 lg:size-8"
            aria-label="Nästa månad"
            disabled={month >= today.slice(0, 7)}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {weekdays.map((day, index) => (
            <span key={index} className="text-muted-foreground" aria-hidden>
              {day}
            </span>
          ))}
          {Array.from({ length: weekdayIndex(first) }, (_, index) => (
            <span key={`pad-${index}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = addDays(first, index)
            const rating = byDate.get(date)
            const average = rating ? averageOf(rating) : 0
            const mood = rating ? moodOf(average) : null
            const future = date > today
            const text = rating
              ? `${formatLongDay(date)}: ${mood?.label}, snitt ${formatAverage(average)}`
              : `${formatLongDay(date)}: ${future ? 'kommer' : 'inte betygsatt'}`
            return (
              <Link
                key={date}
                to={`/schema?vy=dag&datum=${date}`}
                aria-label={text}
                title={text}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md border tabular-nums hover:ring-2 hover:ring-ring/50',
                  !rating && 'border-dashed text-muted-foreground',
                  future && 'opacity-40',
                  date === today && 'ring-1 ring-foreground',
                  mood && mood.level >= 4 && 'text-black',
                )}
                style={
                  mood
                    ? {
                        background: `color-mix(in oklab, ${color} ${10 + mood.level * 18}%, transparent)`,
                        borderColor: 'transparent',
                      }
                    : undefined
                }
              >
                {index + 1}
              </Link>
            )
          })}
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {moods.map((mood) => (
            <li key={mood.level} className="flex items-center gap-1">
              <span
                className="size-3 rounded-sm"
                style={{
                  background: `color-mix(in oklab, ${color} ${10 + mood.level * 18}%, transparent)`,
                }}
                aria-hidden
              />
              <mood.icon className="size-3.5" aria-hidden />
              <span className="sr-only">{mood.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
