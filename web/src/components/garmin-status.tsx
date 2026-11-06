import { CircleAlert, KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  garminErrorMessages,
  garminProblem,
  type GarminStatus,
} from '@/lib/garmin'
import { daysBetween, formatShortDay, relativeDay, todayKey } from '@/lib/schedule'
import { useGarminStatus } from '@/lib/use-garmin'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

const timeFormat = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' })

// "idag 10:42" or "tis 3 nov. 10:42"
function formatSynced(iso: string, today: string) {
  const date = new Date(iso)
  const key = todayKey(date.getTime())
  const day =
    Math.abs(daysBetween(today, key)) <= 1
      ? relativeDay(key, today).toLowerCase()
      : formatShortDay(key)
  return `${day} ${timeFormat.format(date)}`
}

// A reminder when the Garmin key needs replacing or the sync keeps failing.
// Shows nothing when all is well.
export function GarminNotice({
  status,
  today,
}: {
  status: GarminStatus | null
  today: string
}) {
  const problem = garminProblem(status, today)
  if (!problem || !status) return null

  // "sön 15 nov", without the abbreviation's dot before the sentence's.
  const expires = status.keyExpires ? formatShortDay(status.keyExpires).replace(/\.$/, '') : ''
  const message =
    problem === 'key_expiring'
      ? `Garmin-nyckeln går ut ${expires}. Skapa en ny i Garmin Connect och lägg in den i tjänsten innan dess.`
      : problem === 'key_expired'
        ? 'Garmin-nyckeln har gått ut. Skapa en ny i Garmin Connect och lägg in den i tjänsten.'
        : problem === 'key_invalid'
          ? garminErrorMessages.key_invalid
          : garminErrorMessages[status.error ?? 'failed']
  const Icon = problem === 'sync_failed' ? CircleAlert : KeyRound

  return (
    <section
      className={cn(
        'flex items-start gap-2 rounded-xl border bg-card p-3 text-sm',
        problem === 'sync_failed' ? 'border-border' : 'border-primary/60',
      )}
      role={problem === 'key_expiring' ? 'status' : 'alert'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </section>
  )
}

// For Idag: checks the status itself and only shows a key reminder, never a
// passing sync error, so the page stays calm.
export function GarminNoticePanel() {
  const { status } = useGarminStatus()
  const today = todayKey(useNow())
  const problem = garminProblem(status, today)
  if (problem === 'sync_failed') return null
  return <GarminNotice status={status} today={today} />
}

// The line at the top of Hälsa's Garmin sections: when it last synced, and a
// button to sync now.
export function GarminSyncBar({
  state,
  today,
}: {
  state: ReturnType<typeof useGarminStatus>
  today: string
}) {
  const { status, syncing, syncError, syncNow } = state
  if (!status || status.state === 'not_configured') return null
  const busy = syncing || status.state === 'syncing'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {busy
            ? 'Synkar med Garmin…'
            : status.lastSync
              ? `Garmin synkat ${formatSynced(status.lastSync, today)}`
              : 'Inte synkat med Garmin än'}
        </p>
        <Button
          variant="outline"
          className="h-11 lg:h-8"
          disabled={busy}
          onClick={() => void syncNow()}
        >
          <RefreshCw className={cn(busy && 'animate-spin')} aria-hidden />
          Synka nu
        </Button>
      </div>
      {syncError && (
        <p className="text-sm text-destructive" role="alert">
          {syncError}
        </p>
      )}
      <GarminNotice status={status} today={today} />
    </div>
  )
}
