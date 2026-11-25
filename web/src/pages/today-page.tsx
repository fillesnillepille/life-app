import { useState } from 'react'
import { AiKeyNotice } from '@/components/ai-key-notice'
import { DayRatingPrompt } from '@/components/day-rating-prompt'
import { FinanceReminderPanel } from '@/components/finance-reminder'
import { GarminNoticePanel } from '@/components/garmin-status'
import { LightsPanel } from '@/components/lights-panel'
import { MailPanel } from '@/components/mail-panel'
import { SchedulePanel } from '@/components/schedule-panel'
import { DailyTodosPanel } from '@/components/todo-list'
import { formatDuration, formatNumber } from '@/lib/garmin'
import { todayKey } from '@/lib/schedule'
import { useGarminDays } from '@/lib/use-garmin'
import { useNow } from '@/lib/use-now'
import { useSchedule } from '@/lib/use-schedule'
import { useTodos } from '@/lib/use-todos'

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function TodayPage() {
  const [today] = useState(() => dateFormat.format(new Date()))
  const now = useNow()
  // Shared by the panels below, so ticking an item in one shows in the other.
  const schedule = useSchedule()
  const todoState = useTodos()

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2 pb-1">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Idag</h1>
        </div>
      </header>

      <FinanceReminderPanel />

      <GarminNoticePanel />

      <AiKeyNotice />

      <DayRatingPrompt schedule={schedule} now={now} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SchedulePanel schedule={schedule} todoState={todoState} now={now} />

        <LightsPanel />

        <DailyTodosPanel state={todoState} />

        <MailPanel />
      </div>

      <GarminStats today={todayKey(now)} />
    </div>
  )
}

// Last night's sleep and today's steps from Garmin, or a dash before
// anything has synced.
function GarminStats({ today }: { today: string }) {
  const { days } = useGarminDays()
  const day = days?.find((item) => item.date === today)
  const stats = [
    { label: 'SÖMN I NATT', value: day?.sleep ? formatDuration(day.sleep) : '–' },
    { label: 'STEG IDAG', value: day?.steps ? formatNumber(day.steps) : '–' },
  ]
  return (
    <dl className="grid grid-cols-2 divide-x overflow-hidden rounded-xl border bg-card">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 p-3">
          <dt className="truncate text-[10px] tracking-widest text-muted-foreground">
            {stat.label}
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold tabular-nums sm:text-lg">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

