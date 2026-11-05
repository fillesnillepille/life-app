import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { LightsPanel } from '@/components/lights-panel'
import { MailPanel } from '@/components/mail-panel'
import { Panel } from '@/components/panel'
import { DailyTodosPanel } from '@/components/todo-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Everything on this page except the lights and the to-do list is sample data
// for judging the design.
const sampleApprovals = [
  { id: 'reply', source: 'MEJL', text: 'Skicka utkastet till svar till exempelkontakten' },
  { id: 'move', source: 'KALENDER', text: 'Flytta exempelbokningen till torsdag 14:00' },
]

const sampleSchedule = [
  { time: '09:00', title: 'Exempelmöte', next: false },
  { time: '12:30', title: 'Exempellunch', next: true },
  { time: '17:15', title: 'Exempelträning', next: false },
]

const sampleStats = [
  { label: 'SÖMN', value: '7 h 12 min' },
  { label: 'STEG', value: '4 210' },
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

        <Panel title="Schema" meta={`${sampleSchedule.length} händelser`}>
          <ol className="divide-y">
            {sampleSchedule.map((event) => (
              <li
                key={event.time}
                className={cn(
                  'flex items-center gap-3 border-l-2 border-transparent p-3 text-sm',
                  event.next && 'border-primary bg-accent/40',
                )}
              >
                <time className="text-muted-foreground tabular-nums">
                  {event.time}
                </time>
                <span className="min-w-0 flex-1">{event.title}</span>
                {event.next && (
                  <span className="text-[10px] tracking-widest text-primary">
                    NÄSTA
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Panel>

        <LightsPanel />

        <DailyTodosPanel />

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

      <dl className="grid grid-cols-2 divide-x overflow-hidden rounded-xl border bg-card">
        {sampleStats.map((stat) => (
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
    </div>
  )
}

