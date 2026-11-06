import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { AiKeyNotice } from '@/components/ai-key-notice'
import { DayRatingPrompt } from '@/components/day-rating-prompt'
import { FinanceReminderPanel } from '@/components/finance-reminder'
import { GarminNoticePanel } from '@/components/garmin-status'
import { LightsPanel } from '@/components/lights-panel'
import { MailPanel } from '@/components/mail-panel'
import { Panel } from '@/components/panel'
import { SchedulePanel } from '@/components/schedule-panel'
import { DailyTodosPanel } from '@/components/todo-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDuration, formatNumber } from '@/lib/garmin'
import { todayKey } from '@/lib/schedule'
import { useGarminDays } from '@/lib/use-garmin'
import { useNow } from '@/lib/use-now'
import { useSchedule } from '@/lib/use-schedule'
import { useTodos } from '@/lib/use-todos'
import { cn } from '@/lib/utils'

// The approvals and habits on this page are sample data for judging the
// design.
const sampleApprovals = [
  { id: 'reply', source: 'MEJL', text: 'Skicka utkastet till svar till exempelkontakten' },
  { id: 'move', source: 'KALENDER', text: 'Flytta exempelbokningen till torsdag 14:00' },
]

const sampleHabits = [
  { name: 'Läsa', days: [1, 1, 0, 1, 1, 1, 0] },
  { name: 'Träna', days: [1, 0, 1, 0, 1, 0, 0] },
  { name: 'Promenera', days: [1, 1, 1, 1, 0, 1, 1] },
]

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function TodayPage() {
  const [today] = useState(() => dateFormat.format(new Date()))
  const [approvals, setApprovals] = useState(sampleApprovals)
  const now = useNow()
  // Shared by the panels below, so ticking an item in one shows in the other.
  const schedule = useSchedule()
  const todoState = useTodos()

  const resolveApproval = (id: string) =>
    setApprovals((items) => items.filter((item) => item.id !== id))

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2 pb-1">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Idag</h1>
        </div>
        <Badge variant="outline">Prototyp: exempeldata</Badge>
      </header>

      <FinanceReminderPanel />

      <GarminNoticePanel />

      <AiKeyNotice />

      <DayRatingPrompt schedule={schedule} now={now} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel title="Att godkänna" meta={`${approvals.length} väntar`} accent>
          {approvals.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Inget väntar.</p>
          ) : (
            <ul className="divide-y">
              {approvals.map((item) => (
                <li key={item.id} className="p-3">
                  <p className="text-[10px] tracking-widest text-primary">
                    {item.source}
                  </p>
                  <p className="mt-1 text-sm">{item.text}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      className="h-11 lg:h-8"
                      onClick={() => resolveApproval(item.id)}
                    >
                      <Check aria-hidden />
                      Godkänn
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 lg:h-8"
                      onClick={() => resolveApproval(item.id)}
                    >
                      <X aria-hidden />
                      Avvisa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <SchedulePanel schedule={schedule} todoState={todoState} now={now} />

        <LightsPanel />

        <DailyTodosPanel state={todoState} />

        <MailPanel />

        <Panel title="Vanor" meta="Senaste 7 dagarna">
          <ul className="divide-y">
            {sampleHabits.map((habit) => {
              const total = habit.days.reduce((sum, day) => sum + day, 0)
              return (
                <li
                  key={habit.name}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <span>{habit.name}</span>
                  <span
                    className="flex gap-1"
                    role="img"
                    aria-label={`${total} av de senaste 7 dagarna`}
                  >
                    {habit.days.map((day, index) => (
                      <span
                        key={index}
                        className={cn('size-3 bg-muted', day && 'bg-primary')}
                      />
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
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

