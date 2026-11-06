import { Link } from 'react-router'
import { CalendarClock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { formatMonth, missingMonth } from '@/lib/finance'
import { useFinanceMonths } from '@/lib/use-finance'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

export function FinanceReminder({ month }: { month: string }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/60 bg-card p-3">
      <p className="flex min-w-0 items-start gap-2 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Dags att räkna på ekonomin för{' '}
          <span className="font-semibold">{formatMonth(month)}</span>.
        </span>
      </p>
      <Link
        to={`/ekonomi/manad/${month}`}
        className={cn(buttonVariants(), 'h-11 shrink-0 lg:h-8')}
      >
        Fyll i månaden
      </Link>
    </section>
  )
}

// For the Idag page: loads the months itself and shows nothing until it knows
// a month is missing, so a slow or failed load never clutters the page.
export function FinanceReminderPanel() {
  const { months } = useFinanceMonths()
  const now = useNow()
  if (!months) return null
  const month = missingMonth(months, now)
  return month ? <FinanceReminder month={month} /> : null
}
