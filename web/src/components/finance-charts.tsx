import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { Panel } from '@/components/panel'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  formatCompact,
  formatKronor,
  formatMonth,
  formatShortMonth,
  totalOf,
  type FinanceMonth,
} from '@/lib/finance'

const colors = {
  expenses: 'var(--finance-expenses)',
  investments: 'var(--finance-investments)',
  total: 'var(--finance-total)',
}

const chartConfig = {
  expenses: { label: 'Utgifter', color: colors.expenses },
  investments: { label: 'Investeringar', color: colors.investments },
  total: { label: 'Totalt', color: colors.total },
  savings: { label: 'Sparande', color: colors.total },
} satisfies ChartConfig

type Row = {
  month: string
  expenses: number
  investments: number
  savings: number
  total: number
}

function toRows(months: FinanceMonth[]): Row[] {
  return months.map((item) => ({
    month: item.month,
    expenses: item.expenses,
    investments: item.investments,
    savings: item.savings,
    total: totalOf(item),
  }))
}

// The tooltip row: a colour mark, the series name, and the amount in kronor.
function tooltipRow(value: unknown, name: unknown, color?: string) {
  const key = String(name) as keyof typeof chartConfig
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ background: color ?? chartConfig[key]?.color }}
        aria-hidden
      />
      <span className="flex-1 text-muted-foreground">
        {chartConfig[key]?.label ?? String(name)}
      </span>
      <span className="font-medium text-foreground tabular-nums">
        {formatKronor(Number(value))}
      </span>
    </div>
  )
}

function Tooltip() {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          labelFormatter={(_, payload) => {
            const month = payload?.[0]?.payload?.month
            return typeof month === 'string' ? formatMonth(month) : ''
          }}
          formatter={(value, name) => tooltipRow(value, name)}
        />
      }
    />
  )
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

function MonthAxis() {
  return (
    <XAxis
      dataKey="month"
      {...axisProps}
      minTickGap={16}
      tickFormatter={(value: string) => formatShortMonth(value)}
    />
  )
}

function AmountAxis() {
  return (
    <YAxis
      {...axisProps}
      width={44}
      tickFormatter={(value: number) => formatCompact(value)}
    />
  )
}

const chartClass = 'aspect-auto h-56 w-full px-2 pt-3 pb-1'

export function TotalChart({ months }: { months: FinanceMonth[] }) {
  return (
    <Panel title="Totalt" meta="Sparande + investeringar">
      <ChartContainer config={chartConfig} className={chartClass}>
        <AreaChart data={toRows(months)} accessibilityLayer>
          <defs>
            <linearGradient id="finance-total-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.total} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors.total} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <MonthAxis />
          <AmountAxis />
          <Tooltip />
          <Area
            dataKey="total"
            type="monotone"
            stroke={colors.total}
            strokeWidth={2}
            fill="url(#finance-total-fill)"
            dot={months.length === 1 ? { r: 4 } : false}
            activeDot={{ r: 5, stroke: 'var(--background)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartContainer>
    </Panel>
  )
}

export function InvestmentsChart({ months }: { months: FinanceMonth[] }) {
  return (
    <Panel title="Investeringar" meta="Värde vid månadens slut">
      <ChartContainer config={chartConfig} className={chartClass}>
        <LineChart data={toRows(months)} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <MonthAxis />
          <AmountAxis />
          <Tooltip />
          <Line
            dataKey="investments"
            type="monotone"
            stroke={colors.investments}
            strokeWidth={2}
            dot={{ r: 3, fill: colors.investments, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: 'var(--background)', strokeWidth: 2 }}
          />
        </LineChart>
      </ChartContainer>
    </Panel>
  )
}

export function ExpensesChart({ months }: { months: FinanceMonth[] }) {
  const average =
    months.reduce((sum, item) => sum + item.expenses, 0) / (months.length || 1)
  return (
    <Panel title="Utgifter" meta={`Snitt ${formatKronor(average)} / mån`}>
      <ChartContainer config={chartConfig} className={chartClass}>
        <BarChart data={toRows(months)} accessibilityLayer barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <MonthAxis />
          <AmountAxis />
          <Tooltip />
          <Bar
            dataKey="expenses"
            fill={colors.expenses}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          {months.length > 1 && (
            <ReferenceLine
              y={average}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
            />
          )}
        </BarChart>
      </ChartContainer>
    </Panel>
  )
}

// How the latest total splits between savings and investments.
export function SplitChart({ month }: { month: FinanceMonth }) {
  const total = totalOf(month)
  const parts = [
    { key: 'savings', label: 'Sparande', value: month.savings, fill: colors.total },
    {
      key: 'investments',
      label: 'Investeringar',
      value: month.investments,
      fill: colors.investments,
    },
  ]
  const share = (value: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'percent' }).format(
      total ? value / total : 0,
    )

  return (
    <Panel title="Fördelning" meta={formatMonth(month.month)}>
      <div className="flex flex-col items-center gap-4 p-3 sm:flex-row lg:flex-col">
        <ChartContainer
          config={chartConfig}
          className="aspect-square h-36 shrink-0"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) =>
                    tooltipRow(value, item.payload?.key, item.payload?.fill)
                  }
                />
              }
            />
            <Pie
              data={parts}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="100%"
              stroke="var(--background)"
              strokeWidth={2}
            />
          </PieChart>
        </ChartContainer>
        <ul className="grid w-full min-w-0 flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-1 lg:grid-cols-2">
          {parts.map((part) => (
            <li key={part.key}>
              <p className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: part.fill }}
                  aria-hidden
                />
                {part.label}
              </p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatKronor(part.value)}{' '}
                <span className="font-normal text-muted-foreground">
                  {share(part.value)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
