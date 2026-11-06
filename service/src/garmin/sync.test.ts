import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGarminSync } from './sync.ts'
import {
  GarminKeyError,
  type ActivityRecord,
  type DayRecord,
  type GarminSource,
  type GarminStore,
} from './types.ts'

// 12:00 on 6 November 2026 in Stockholm.
const NOW = Date.UTC(2026, 10, 6, 11)

function memoryStore<T extends object>(initial: T[] = []) {
  let next = 1
  const rows = new Map<string, T & { id: string }>()
  for (const row of initial) rows.set(`r${next}`, { ...row, id: `r${next++}` })
  const log: string[] = []
  return {
    rows,
    log,
    store: {
      list: async () => [...rows.values()],
      create: async (record: T) => {
        log.push('create')
        rows.set(`r${next}`, { ...record, id: `r${next++}` })
      },
      update: async (id: string, changes: Partial<T>) => {
        log.push(`update ${Object.keys(changes).join(',')}`)
        rows.set(id, { ...rows.get(id)!, ...changes })
      },
      remove: async (id: string) => {
        log.push('remove')
        rows.delete(id)
      },
    },
  }
}

const rawActivity = (id: number, date: string, extra: object = {}) => ({
  activityId: id,
  activityName: `Pass ${id}`,
  startTimeLocal: `${date} 07:00:00`,
  startTimeGMT: `${date} 06:00:00`,
  activityType: { typeKey: 'running' },
  duration: 1800,
  ...extra,
})

const storedActivity = (id: number, date: string): ActivityRecord => ({
  garminId: id,
  name: `Pass ${id}`,
  type: 'running',
  date,
  startTime: '07:00',
  // PocketBase's own date format.
  startedAt: `${date} 06:00:00.000Z`,
  duration: 1800,
  elapsed: 0,
  moving: 0,
  distance: 0,
  elevationGain: 0,
  averageHr: 0,
  maxHr: 0,
  calories: 0,
  averageSpeed: 0,
})

function setup(options: {
  activities?: unknown[]
  summaries?: unknown[]
  storedActivities?: ActivityRecord[]
  storedDays?: DayRecord[]
  fail?: Error
}) {
  const calls: Array<{ kind: string; from?: string; to?: string }> = []
  const source: GarminSource = {
    async activities(from, to) {
      calls.push({ kind: 'activities', from, to })
      if (options.fail) throw options.fail
      return options.activities ?? []
    },
    async dailySummaries(from, to) {
      calls.push({ kind: 'summaries', from, to })
      return options.summaries ?? []
    },
    async sleep(from, to) {
      calls.push({ kind: 'sleep', from, to })
      return []
    },
    async hrv(from, to) {
      calls.push({ kind: 'hrv', from, to })
      return []
    },
  }
  const activities = memoryStore(options.storedActivities)
  const days = memoryStore(options.storedDays)
  const store: GarminStore = { activities: activities.store, days: days.store }
  const sync = createGarminSync({
    source,
    store,
    timeZone: 'Europe/Stockholm',
    keyExpires: '2027-11-06',
    now: () => NOW,
  })
  return { sync, calls, activities, days }
}

describe('Garmin sync', () => {
  it('takes every activity and a year of days the first time', async () => {
    const { sync, calls, activities } = setup({
      activities: [rawActivity(1, '2026-11-05'), rawActivity(2, '2025-06-01')],
    })
    const status = await sync.syncNow()
    assert.equal(status.state, 'ok')
    assert.equal(status.keyExpires, '2027-11-06')
    assert.deepEqual(calls[0], { kind: 'activities', from: undefined, to: '2026-11-06' })
    assert.deepEqual(calls[1], { kind: 'summaries', from: '2025-11-06', to: '2026-11-06' })
    assert.equal(activities.rows.size, 2)
  })

  it('looks back a month for activities and a week for days after that', async () => {
    const { sync, calls } = setup({
      storedActivities: [storedActivity(1, '2026-11-05')],
      storedDays: [{ date: '2026-11-05' } as DayRecord],
    })
    await sync.syncNow()
    assert.equal(calls[0].from, '2026-10-07')
    assert.equal(calls[1].from, '2026-10-30')
  })

  it('goes back further when the service was off for a while', async () => {
    const { sync, calls } = setup({
      storedActivities: [storedActivity(1, '2026-08-01')],
      storedDays: [{ date: '2026-08-01' } as DayRecord],
    })
    await sync.syncNow()
    assert.equal(calls[0].from, '2026-08-01')
    assert.equal(calls[1].from, '2026-08-01')
  })

  it('updates changed activities and removes deleted ones in range', async () => {
    const { sync, activities } = setup({
      storedActivities: [
        storedActivity(1, '2026-11-05'),
        storedActivity(2, '2026-11-04'),
        // Older than the month that's read again, so it's kept.
        storedActivity(3, '2026-01-01'),
      ],
      activities: [rawActivity(1, '2026-11-05', { activityName: 'Intervaller' })],
    })
    await sync.syncNow()
    assert.deepEqual(activities.log, ['update name', 'remove'])
    assert.deepEqual(
      [...activities.rows.values()].map((row) => row.garminId).sort(),
      [1, 3],
    )
  })

  it("doesn't rewrite an activity whose time only differs in format", async () => {
    const { sync, activities } = setup({
      storedActivities: [storedActivity(1, '2026-11-05')],
      activities: [rawActivity(1, '2026-11-05')],
    })
    await sync.syncNow()
    assert.deepEqual(activities.log, [])
  })

  it('updates only the day fields that changed', async () => {
    const { sync, days } = setup({
      storedDays: [
        {
          date: '2026-11-06',
          steps: 1000,
          restingHr: 50,
        } as DayRecord,
      ],
      summaries: [
        {
          calendarDate: '2026-11-06',
          movement: { steps: { value: 4200 } },
          heartRate: { restingValue: 50 },
        },
      ],
    })
    await sync.syncNow()
    assert.equal(days.log.length, 1)
    assert.match(days.log[0], /^update .*steps/)
    assert.doesNotMatch(days.log[0], /restingHr/)
  })

  it('reports a refused key without throwing', async () => {
    const { sync } = setup({ fail: new GarminKeyError() })
    const status = await sync.syncNow()
    assert.equal(status.state, 'error')
    assert.equal(status.error, 'key_invalid')
    assert.equal(status.lastSync, null)
  })

  it('runs one sync at a time', async () => {
    const { sync, calls } = setup({})
    await Promise.all([sync.syncNow(), sync.syncNow()])
    assert.equal(calls.filter((call) => call.kind === 'activities').length, 1)
  })
})
