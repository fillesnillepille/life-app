import { useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus } from 'lucide-react'
import {
  ExpensesChart,
  InvestmentsChart,
  SplitChart,
  TotalChart,
} from '@/components/finance-charts'
import { FinanceReminder } from '@/components/finance-reminder'
import { Loading, LoadError } from '@/components/load-status'
import { Panel } from '@/components/panel'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatKronor,
  formatMonth,
  formatPercent,
  formatSignedKronor,
  missingMonth,
  totalOf,
  type FinanceMonth,
} from '@/lib/finance'
import { useFinanceMonths } from '@/lib/use-finance'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

type Range = 'year' | 'all'

function changeText(current: number, previous: number | undefined) {
  if (previous === undefined) return 'Första månaden'
  const change = current - previous
  const percent = previous ? ` (${formatPercent(change / previous)})` : ''
  return `${formatSignedKronor(change)}${percent} mot förra`
}

function Stat({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <div className="min-w-0 p-3">
      <dt className="flex items-center gap-2 truncate text-[10px] tracking-widest text-muted-foreground uppercase">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ background: color }}
          aria-hidden
        />
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
        {detail}
      </dd>
    </div>
  )
}

function Summary({ months }: { months: FinanceMonth[] }) {
  const latest = months[months.length - 1]
  const previous = months.length > 1 ? months[months.length - 2] : undefined
  const average =
    months.reduce((sum, item) => sum + item.expenses, 0) / months.length
  // Returns are only meaningful once deposits are being filled in.
  const tracksDeposits = months.some((item) => item.deposited !== 0)
  const investmentDetail =
    previous && tracksDeposits
      ? `Avkastning ${formatSignedKronor(
          latest.investments - previous.investments - latest.deposited,
        )}`
      : changeText(latest.investments, previous?.investments)

  return (
    <dl className="grid divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Stat
        label="Totalt"
        value={formatKronor(totalOf(latest))}
        detail={changeText(totalOf(latest), previous && totalOf(previous))}
        color="var(--finance-total)"
      />
      <Stat
        label="Investeringar"
        value={formatKronor(latest.investments)}
        detail={investmentDetail}
        color="var(--finance-investments)"
      />
      <Stat
        label={`Utgifter ${formatMonth(latest.month)}`}
        value={formatKronor(latest.expenses)}
        detail={`Snitt ${formatKronor(average)} / mån`}
        color="var(--finance-expenses)"
      />
    </dl>
  )
}

// Every month as a table: the numbers behind the charts, and the way to edit
// an old month.
function MonthTable({ months }: { months: FinanceMonth[] }) {
  return (
    <Panel title="Alla månader" meta={`${months.length} st`}>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 text-left font-normal">Månad</th>
              <th className="p-3 text-right font-normal">Utgifter</th>
              <th className="hidden p-3 text-right font-normal sm:table-cell">
                Sparande
              </th>
              <th className="hidden p-3 text-right font-normal sm:table-cell">
                Investeringar
              </th>
              <th className="p-3 text-right font-normal">Totalt</th>
              <th className="w-12 p-3">
                <span className="sr-only">Ändra</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...months].reverse().map((item) => (
              <tr key={item.id}>
                <td className="p-3 whitespace-nowrap first-letter:uppercase">
                  {formatMonth(item.month)}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {formatKronor(item.expenses)}
                </td>
                <td className="hidden p-3 text-right whitespace-nowrap sm:table-cell">
                  {formatKronor(item.savings)}
                </td>
                <td className="hidden p-3 text-right whitespace-nowrap sm:table-cell">
                  {formatKronor(item.investments)}
                </td>
                <td className="p-3 text-right font-semibold whitespace-nowrap">
                  {formatKronor(totalOf(item))}
                </td>
                <td className="py-1 pr-2 text-right">
                  <Link
                    to={`/ekonomi/manad/${item.month}`}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'icon' }),
                      'size-11 lg:size-8',
                    )}
                    aria-label={`Ändra ${formatMonth(item.month)}`}
                  >
                    <Pencil aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function MoneyPage() {
  const { months, loadError, retry } = useFinanceMonths()
  const now = useNow()
  const [range, setRange] = useState<Range>('year')

  const missing = months && months.length > 0 ? missingMonth(months, now) : null
  const shown =
    months && range === 'year' ? months.slice(-12) : (months ?? [])
  const latest = months?.[months.length - 1]

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Ekonomi</h1>
        <Link
          to="/ekonomi/manad"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-11 lg:h-8')}
        >
          <Plus aria-hidden />
          Fyll i månad
        </Link>
      </header>

      {loadError && !months && (
        <div className="rounded-xl border">
          <LoadError message={loadError} onRetry={retry} />
        </div>
      )}

      {!months && !loadError && <Loading>Hämtar ekonomin…</Loading>}

      {months && months.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="font-semibold">Inga månader än</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Fyll i utgifter, sparande och investeringar en gång i månaden, så
            växer graferna här fram.
          </p>
          <Link
            to="/ekonomi/manad"
            className={cn(buttonVariants(), 'mt-4 h-11 lg:h-8')}
          >
            Fyll i första månaden
          </Link>
        </div>
      )}

      {missing && <FinanceReminder month={missing} />}

      {months && latest && (
        <>
          <Summary months={shown} />

          {months.length > 12 && (
            <Tabs
              value={range}
              onValueChange={(value) => setRange(value as Range)}
            >
              <TabsList className="h-11 lg:h-9">
                <TabsTrigger value="year" className="px-4">
                  12 månader
                </TabsTrigger>
                <TabsTrigger value="all" className="px-4">
                  Allt
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <TotalChart months={shown} />
            </div>
            <SplitChart month={latest} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <InvestmentsChart months={shown} />
            <ExpensesChart months={shown} />
          </div>

          <MonthTable months={months} />
        </>
      )}
    </section>
  )
}
