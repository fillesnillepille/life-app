// One activity as the app stores it (`garmin_activities`). Only the summary:
// no route and no second-by-second data. Missing numbers are 0.
export type ActivityRecord = {
  garminId: number
  name: string
  // Garmin's type key, such as "running".
  type: string
  // Local date and start time: "2026-11-06" and "07:30".
  date: string
  startTime: string
  // ISO 8601, UTC.
  startedAt: string
  // Seconds.
  duration: number
  elapsed: number
  moving: number
  // Metres.
  distance: number
  elevationGain: number
  averageHr: number
  maxHr: number
  calories: number
  // Metres per second.
  averageSpeed: number
}

// One day as the app stores it (`garmin_days`): the night's sleep that ends
// on this date, HRV, and the day's summary. Missing numbers are 0.
export type DayRecord = {
  date: string
  // Seconds.
  sleep: number
  deepSleep: number
  lightSleep: number
  remSleep: number
  awake: number
  sleepScore: number
  // "23:10", local time, or empty.
  sleepStart: string
  sleepEnd: string
  hrvLastNight: number
  hrvWeekly: number
  hrvStatus: string
  restingHr: number
  steps: number
  stepsGoal: number
  stress: number
  bodyBatteryHigh: number
  bodyBatteryLow: number
  activeCalories: number
  moderateMinutes: number
  vigorousMinutes: number
}

// What went wrong in the last sync, as a code the app turns into Swedish.
export type GarminErrorCode =
  | 'key_invalid'
  | 'rate_limited'
  | 'unreachable'
  | 'failed'

export type GarminStatus = {
  state: 'not_configured' | 'syncing' | 'ok' | 'error'
  // ISO 8601: the last sync that finished, and the last one tried.
  lastSync: string | null
  lastAttempt: string | null
  error: GarminErrorCode | null
  // "2027-11-06", when the API key runs out, if it was given.
  keyExpires: string | null
}

// Raised when Garmin refuses the API key: it was deleted, ran out, or was
// copied wrong. Retrying won't help until a new key is in place.
export class GarminKeyError extends Error {
  constructor() {
    super('key_invalid')
  }
}

export class GarminRateLimitError extends Error {
  constructor() {
    super('rate_limited')
  }
}

// Garmin's Personal API, as raw JSON. Dates are local "2026-11-06" text and
// both ends are included.
export interface GarminSource {
  // Newest first. `from` left out means all of them.
  activities(from?: string, to?: string): Promise<unknown[]>
  dailySummaries(from: string, to: string): Promise<unknown[]>
  sleep(from: string, to: string): Promise<unknown[]>
  hrv(from: string, to: string): Promise<unknown[]>
}

export interface GarminStore {
  activities: Store<ActivityRecord>
  days: Store<DayRecord>
}

interface Store<T> {
  list(filter?: string): Promise<Array<T & { id: string }>>
  create(record: T): Promise<void>
  update(id: string, changes: Partial<T>): Promise<void>
  remove(id: string): Promise<void>
}

// What the HTTP routes use.
export interface GarminService {
  status(): GarminStatus
  // Runs a sync now, or waits for the one already running, and returns the
  // status afterwards.
  syncNow(): Promise<GarminStatus>
}
