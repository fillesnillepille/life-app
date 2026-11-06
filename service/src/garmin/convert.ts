import type { ActivityRecord, DayRecord } from './types.ts'

// Turns Garmin's JSON into the records the app stores. Garmin leaves out
// fields it has no value for, so anything missing or odd becomes 0 or empty.

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const object = (value: unknown): Json => (isObject(value) ? value : {})

function num(value: unknown, digits = 0) {
  const n = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(n) || n < 0) return 0
  const scale = 10 ** digits
  return Math.round(n * scale) / scale
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : ''

const DATE = /^\d{4}-\d{2}-\d{2}/
const CLOCK = /(?:^|[T ])(\d{2}):(\d{2})/

// "2026-11-06 07:30:00" → "07:30"
function clockOf(value: string) {
  const match = CLOCK.exec(value.slice(10))
  return match ? `${match[1]}:${match[2]}` : ''
}

// Garmin gives local sleep times either as text or as milliseconds that
// already include the time zone offset, so the UTC clock of that number is
// the local clock.
function localClock(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(11, 16)
  }
  return typeof value === 'string' && DATE.test(value) ? clockOf(value) : ''
}

// "2026-11-06 06:30:00" in UTC → ISO 8601.
function utcIso(value: unknown) {
  if (typeof value !== 'string' || !DATE.test(value)) return ''
  const date = new Date(`${value.replace(' ', 'T').replace(/Z?$/, 'Z')}`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function toActivity(raw: unknown): ActivityRecord | null {
  const a = object(raw)
  const garminId = a.activityId
  const local = typeof a.startTimeLocal === 'string' ? a.startTimeLocal : ''
  if (typeof garminId !== 'number' || !Number.isSafeInteger(garminId) || !DATE.test(local)) {
    return null
  }
  return {
    garminId,
    name: text(a.activityName, 500),
    type: text(object(a.activityType).typeKey, 100),
    date: local.slice(0, 10),
    startTime: clockOf(local),
    startedAt: utcIso(a.startTimeGMT),
    duration: num(a.duration),
    elapsed: num(a.elapsedDuration),
    moving: num(a.movingDuration),
    distance: num(a.distance, 1),
    elevationGain: num(a.elevationGain),
    averageHr: num(a.averageHR),
    maxHr: num(a.maxHR),
    calories: num(a.calories),
    averageSpeed: num(a.averageSpeed, 3),
  }
}

export const emptyDay = (date: string): DayRecord => ({
  date,
  sleep: 0,
  deepSleep: 0,
  lightSleep: 0,
  remSleep: 0,
  awake: 0,
  sleepScore: 0,
  sleepStart: '',
  sleepEnd: '',
  hrvLastNight: 0,
  hrvWeekly: 0,
  hrvStatus: '',
  restingHr: 0,
  steps: 0,
  stepsGoal: 0,
  stress: 0,
  bodyBatteryHigh: 0,
  bodyBatteryLow: 0,
  activeCalories: 0,
  moderateMinutes: 0,
  vigorousMinutes: 0,
})

const dateOf = (raw: Json) => {
  const date = raw.calendarDate
  return typeof date === 'string' && DATE.test(date) ? date.slice(0, 10) : null
}

function summaryFields(raw: Json): Partial<DayRecord> {
  const steps = object(object(raw.movement).steps)
  const heart = object(raw.heartRate)
  const stress = object(raw.stress)
  const battery = object(raw.bodyBattery)
  const calories = object(raw.calories)
  const intensity = object(raw.intensityMinutes)
  return {
    steps: num(steps.value),
    stepsGoal: num(steps.goal),
    restingHr: num(heart.restingValue),
    stress: num(stress.avgLevel),
    bodyBatteryHigh: num(battery.maxValue),
    bodyBatteryLow: num(battery.minValue),
    activeCalories: num(calories.burnedActive),
    moderateMinutes: num(intensity.moderate),
    vigorousMinutes: num(intensity.vigorous),
  }
}

function sleepFields(raw: Json): Partial<DayRecord> {
  return {
    sleep: num(raw.sleepTimeSeconds),
    deepSleep: num(raw.deepSleepSeconds),
    lightSleep: num(raw.lightSleepSeconds),
    remSleep: num(raw.remSleepSeconds),
    awake: num(raw.awakeSleepSeconds),
    sleepScore: num(object(object(raw.sleepScores).overall).value),
    sleepStart: localClock(raw.sleepStartTimestampLocal),
    sleepEnd: localClock(raw.sleepEndTimestampLocal),
  }
}

function hrvFields(raw: Json): Partial<DayRecord> {
  return {
    hrvLastNight: num(raw.lastNightAvg),
    hrvWeekly: num(raw.weeklyAvg),
    hrvStatus: text(raw.status, 40),
  }
}

// Joins the three sources into one record per date. Days with nothing in
// them are left out, so a long first sync doesn't fill the store with
// empty days from before the watch was worn.
export function toDays(sources: {
  summaries: unknown[]
  sleep: unknown[]
  hrv: unknown[]
}): DayRecord[] {
  const days = new Map<string, DayRecord>()
  const merge = (rows: unknown[], fields: (raw: Json) => Partial<DayRecord>) => {
    for (const row of rows) {
      const raw = object(row)
      const date = dateOf(raw)
      if (!date) continue
      const day = days.get(date) ?? emptyDay(date)
      // Only fill in values, so a source without data doesn't blank out
      // another's.
      for (const [key, value] of Object.entries(fields(raw))) {
        if (value) Object.assign(day, { [key]: value })
      }
      days.set(date, day)
    }
  }
  merge(sources.summaries, summaryFields)
  merge(sources.sleep, sleepFields)
  merge(sources.hrv, hrvFields)

  return [...days.values()]
    // A goal alone isn't data: Garmin reports it for empty days too.
    .filter((day) =>
      Object.entries(day).some(
        ([key, value]) => key !== 'date' && key !== 'stepsGoal' && value,
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}
