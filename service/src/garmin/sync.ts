import { toActivity, toDays } from './convert.ts'
import { addDays, todayIn } from './garmin-source.ts'
import {
  GarminKeyError,
  GarminRateLimitError,
  type ActivityRecord,
  type DayRecord,
  type GarminErrorCode,
  type GarminService,
  type GarminSource,
  type GarminStatus,
  type GarminStore,
} from './types.ts'

const SYNC_MS = 60 * 60_000
// How far back each sync looks again, to catch late sleep data, edits, and
// deleted activities.
const DAYS_BACK = 7
const ACTIVITIES_BACK = 30
// The first sync takes up to a year of daily data, and every activity.
const FIRST_DAYS_BACK = 365

const ACTIVITY_FIELDS = [
  'name',
  'type',
  'date',
  'startTime',
  'duration',
  'elapsed',
  'moving',
  'distance',
  'elevationGain',
  'averageHr',
  'maxHr',
  'calories',
  'averageSpeed',
] as const satisfies readonly (keyof ActivityRecord)[]

function changesOf<T extends object>(
  current: T,
  next: T,
  fields: readonly (keyof T)[],
): Partial<T> {
  const changes: Partial<T> = {}
  for (const field of fields) {
    if (current[field] !== next[field]) changes[field] = next[field]
  }
  return changes
}

function errorCode(error: unknown): GarminErrorCode {
  if (error instanceof GarminKeyError) return 'key_invalid'
  if (error instanceof GarminRateLimitError) return 'rate_limited'
  if (error instanceof Error && error.message === 'unreachable') return 'unreachable'
  return 'failed'
}

// Keeps the stored activities and days the same as Garmin's: new ones are
// added and changed ones updated. Activities deleted at Garmin are removed
// if they fall in the range just read. Days are never removed.
export function createGarminSync(options: {
  source: GarminSource
  store: GarminStore
  timeZone: string
  keyExpires?: string | null
  // Test hooks.
  intervalMs?: number
  now?: () => number
}): GarminService & { start(): void; stop(): void } {
  const { source, store, timeZone } = options
  const now = options.now ?? Date.now
  let status: GarminStatus = {
    state: 'syncing',
    lastSync: null,
    lastAttempt: null,
    error: null,
    keyExpires: options.keyExpires ?? null,
  }
  let running: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | undefined

  async function syncActivities(today: string) {
    const stored = await store.activities.list()
    const latest = stored.reduce((max, row) => (row.date > max ? row.date : max), '')
    // Everything on the first sync, otherwise the last month, or back to the
    // newest stored activity if the service was off for longer.
    const from = latest
      ? [addDays(today, -ACTIVITIES_BACK), latest].sort()[0]
      : undefined
    const fetched = (await source.activities(from, today))
      .map(toActivity)
      .filter((row): row is ActivityRecord => row !== null)
    const wanted = new Map(fetched.map((row) => [row.garminId, row]))
    const byId = new Map(stored.map((row) => [row.garminId, row]))

    for (const [id, record] of wanted) {
      const current = byId.get(id)
      if (!current) {
        await store.activities.create(record)
        continue
      }
      const changes = changesOf(current, record, ACTIVITY_FIELDS)
      if (Date.parse(current.startedAt) !== Date.parse(record.startedAt)) {
        changes.startedAt = record.startedAt
      }
      if (Object.keys(changes).length > 0) {
        await store.activities.update(current.id, changes)
      }
    }
    for (const row of stored) {
      const inRange = (!from || row.date >= from) && row.date <= today
      if (inRange && !wanted.has(row.garminId)) {
        await store.activities.remove(row.id)
      }
    }
  }

  async function syncDays(today: string) {
    const stored = await store.days.list()
    const latest = stored.reduce((max, row) => (row.date > max ? row.date : max), '')
    const from = latest
      ? [addDays(today, -DAYS_BACK), latest, addDays(today, -FIRST_DAYS_BACK)].sort()[1]
      : addDays(today, -FIRST_DAYS_BACK)
    const days = toDays({
      summaries: await source.dailySummaries(from, today),
      sleep: await source.sleep(from, today),
      hrv: await source.hrv(from, today),
    })
    const byDate = new Map(stored.map((row) => [row.date, row]))
    for (const day of days) {
      const current = byDate.get(day.date)
      if (!current) {
        await store.days.create(day)
        continue
      }
      const fields = Object.keys(day).filter((key) => key !== 'date') as (keyof DayRecord)[]
      const changes = changesOf<DayRecord>(current, day, fields)
      if (Object.keys(changes).length > 0) await store.days.update(current.id, changes)
    }
  }

  async function run() {
    const attempt = new Date(now()).toISOString()
    status = { ...status, state: 'syncing', lastAttempt: attempt }
    try {
      const today = todayIn(timeZone, now())
      await syncActivities(today)
      await syncDays(today)
      status = {
        ...status,
        state: 'ok',
        lastSync: new Date(now()).toISOString(),
        error: null,
      }
    } catch (error) {
      status = { ...status, state: 'error', error: errorCode(error) }
      console.error(
        'Garmin sync failed:',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
  }

  // One sync at a time. A request during a sync waits for that one.
  function syncOnce() {
    running ??= run().finally(() => {
      running = null
    })
    return running
  }

  return {
    status: () => status,
    async syncNow() {
      await syncOnce()
      return status
    },
    start() {
      void syncOnce()
      timer = setInterval(() => {
        // A refused key won't start working by itself, so stop asking until
        // the service restarts with a new key, or "Synka nu" is pressed.
        if (status.error === 'key_invalid') return
        void syncOnce()
      }, options.intervalMs ?? SYNC_MS)
    },
    stop() {
      clearInterval(timer)
    },
  }
}

// What the status endpoint reports when no Garmin key is set up.
export const noGarmin: GarminService = {
  status: () => ({
    state: 'not_configured',
    lastSync: null,
    lastAttempt: null,
    error: null,
    keyExpires: null,
  }),
  syncNow: async () => noGarmin.status(),
}
