// Training and health data from Garmin, as the service stores it, and the
// sums, labels, and formats Hälsa, Schema, and Idag show. Numbers Garmin
// didn't report are 0 and count as missing.

import {
  Activity as ActivityIcon,
  Bike,
  Dumbbell,
  Footprints,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { addDays, isoWeek, minutesOf, mondayOf, timeOf } from '@/lib/schedule'

export type Activity = {
  id: string
  garminId: number
  name: string
  type: string
  date: string
  // "07:30"
  startTime: string
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

export type GarminDay = {
  id: string
  date: string
  // Seconds.
  sleep: number
  deepSleep: number
  lightSleep: number
  remSleep: number
  awake: number
  sleepScore: number
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

export type GarminErrorCode = 'key_invalid' | 'rate_limited' | 'unreachable' | 'failed'

export type GarminStatus = {
  state: 'not_configured' | 'syncing' | 'ok' | 'error'
  lastSync: string | null
  lastAttempt: string | null
  error: GarminErrorCode | null
  // "2027-11-06"
  keyExpires: string | null
}

// Sports ---------------------------------------------------------------------

const sportLabels: Record<string, string> = {
  running: 'Löpning',
  treadmill_running: 'Löpband',
  trail_running: 'Terränglöpning',
  track_running: 'Banlöpning',
  indoor_running: 'Inomhuslöpning',
  virtual_run: 'Virtuell löpning',
  cycling: 'Cykling',
  road_biking: 'Landsvägscykling',
  mountain_biking: 'Mountainbike',
  gravel_cycling: 'Gravelcykling',
  indoor_cycling: 'Inomhuscykling',
  virtual_ride: 'Virtuell cykling',
  e_bike_fitness: 'Elcykel',
  walking: 'Promenad',
  casual_walking: 'Promenad',
  speed_walking: 'Rask promenad',
  hiking: 'Vandring',
  swimming: 'Simning',
  lap_swimming: 'Bassängsimning',
  open_water_swimming: 'Simning i öppet vatten',
  strength_training: 'Styrketräning',
  fitness_equipment: 'Gym',
  cardio: 'Kondition',
  hiit: 'HIIT',
  yoga: 'Yoga',
  pilates: 'Pilates',
  breathwork: 'Andning',
  indoor_rowing: 'Roddmaskin',
  rowing: 'Rodd',
  elliptical: 'Crosstrainer',
  stair_climbing: 'Trappmaskin',
  floor_climbing: 'Trappor',
  cross_country_skiing_ws: 'Längdskidor',
  skate_skiing_ws: 'Skate',
  resort_skiing_snowboarding_ws: 'Utförsåkning',
  backcountry_skiing: 'Turskidor',
  bouldering: 'Bouldering',
  indoor_climbing: 'Klättring inomhus',
  rock_climbing: 'Klättring',
  tennis: 'Tennis',
  padel: 'Padel',
  soccer: 'Fotboll',
  golf: 'Golf',
  multi_sport: 'Multisport',
  other: 'Övrigt',
}

// "Löpning", or Garmin's own key tidied up for types not in the list.
export function sportLabel(type: string) {
  if (sportLabels[type]) return sportLabels[type]
  if (!type) return 'Aktivitet'
  const words = type.replace(/_ws$/, '').replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

type SportKind = 'foot' | 'bike' | 'swim' | 'strength' | 'other'

function sportKind(type: string): SportKind {
  if (/run|walk|hik/.test(type)) return 'foot'
  if (/cycl|bik|ride/.test(type)) return 'bike'
  if (/swim/.test(type)) return 'swim'
  if (/strength|fitness_equipment|hiit/.test(type)) return 'strength'
  return 'other'
}

const kindIcons: Record<SportKind, LucideIcon> = {
  foot: Footprints,
  bike: Bike,
  swim: Waves,
  strength: Dumbbell,
  other: ActivityIcon,
}

export const sportIcon = (type: string) => kindIcons[sportKind(type)]

// Garmin logs breathing exercises and meditation as activities. They show
// in the list and in Schema, but don't count as training: not in training
// time, the Träning grade, or training days.
const notTraining = new Set(['breathwork', 'meditation'])

export const isTraining = (activity: Pick<Activity, 'type'>) =>
  !notTraining.has(activity.type)

// The activity's name in Garmin, such as "Stockholm Löpning", or the sport
// when it has none.
export const activityTitle = (activity: Activity) =>
  activity.name || sportLabel(activity.type)

// Formats --------------------------------------------------------------------

const decimal1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const decimal2 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const whole = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

export const formatNumber = (value: number) => whole.format(value)

// "42 min" or "1 h 05 min"
export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

// "3,5 h", for chart axes and sums.
export const formatHours = (seconds: number) => `${decimal1.format(seconds / 3600)} h`

// "5,01 km", or "12,3 km" from 10 km.
export function formatDistance(metres: number) {
  const km = metres / 1000
  return `${km < 10 ? decimal2.format(km) : decimal1.format(km)} km`
}

// "5:32 /km" for sports on foot, "24,1 km/h" for cycling, or null.
export function formatPace(activity: Pick<Activity, 'type' | 'averageSpeed' | 'distance'>) {
  if (!activity.averageSpeed || !activity.distance) return null
  const kind = sportKind(activity.type)
  if (kind === 'foot') {
    const secondsPerKm = Math.round(1000 / activity.averageSpeed)
    const minutes = Math.floor(secondsPerKm / 60)
    return `${minutes}:${String(secondsPerKm % 60).padStart(2, '0')} /km`
  }
  if (kind === 'bike') return `${decimal1.format(activity.averageSpeed * 3.6)} km/h`
  return null
}

const hrvStatuses: Record<string, string> = {
  BALANCED: 'Balanserad',
  UNBALANCED: 'Obalanserad',
  LOW: 'Låg',
  POOR: 'Låg',
}

export const hrvStatusLabel = (status: string) =>
  hrvStatuses[status.toUpperCase()] ?? ''

// The timeline ---------------------------------------------------------------

export type TimelineActivity = {
  id: string
  title: string
  type: string
  start: string
  end: string
  detail: string
}

// Where an activity sits on the day's timeline. It ends at midnight at the
// latest, since a workout past midnight is rare and belongs to its start day.
export function timelineActivity(activity: Activity): TimelineActivity | null {
  if (!activity.startTime) return null
  const length = Math.max(1, Math.round((activity.elapsed || activity.duration) / 60))
  const from = minutesOf(activity.startTime)
  const end = from + length >= 1440 ? '00:00' : timeOf(from + length)
  return {
    id: activity.id,
    title: activityTitle(activity),
    type: activity.type,
    start: activity.startTime,
    end,
    detail: [
      sportLabel(activity.type),
      formatDuration(activity.duration),
      activity.distance ? formatDistance(activity.distance) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

// The Träning grade ----------------------------------------------------------

// Minutes trained that day, mapped to the Träning grade: nothing is 1, under
// 20 minutes 2, under 45 minutes 3, under 90 minutes 4, and 90 or more 5.
// Change the limits here.
export const exerciseGradeLimits = [20, 45, 90]

export function exerciseGradeFor(minutes: number) {
  if (minutes <= 0) return 1
  const index = exerciseGradeLimits.findIndex((limit) => minutes < limit)
  return index === -1 ? 5 : index + 2
}

export type ExerciseSuggestion = { grade: number; text: string }

// The suggested Träning grade for a date, or null when Garmin has nothing
// for it, so a day the watch wasn't worn isn't graded 1.
export function exerciseSuggestion(
  date: string,
  activities: Activity[] | null,
  days: GarminDay[] | null,
): ExerciseSuggestion | null {
  if (!activities || !days) return null
  const ofDay = activities.filter((activity) => activity.date === date && isTraining(activity))
  const worn = days.some((day) => day.date === date)
  if (ofDay.length === 0 && !worn) return null
  const seconds = ofDay.reduce((sum, activity) => sum + activity.duration, 0)
  const grade = exerciseGradeFor(seconds / 60)
  if (ofDay.length === 0) return { grade, text: 'Förslag från Garmin: ingen träning registrerad.' }
  const sports = [...new Set(ofDay.map((activity) => sportLabel(activity.type)))].join(', ')
  return {
    grade,
    text: `Förslag från Garmin: ${formatDuration(seconds)} (${sports}).`,
  }
}

// Sums -----------------------------------------------------------------------

export type Totals = { count: number; seconds: number; distance: number }

export function totalsOf(activities: Activity[]): Totals {
  return activities.reduce(
    (sum, activity) => ({
      count: sum.count + 1,
      seconds: sum.seconds + activity.duration,
      distance: sum.distance + activity.distance,
    }),
    { count: 0, seconds: 0, distance: 0 },
  )
}

export type PeriodRow = { key: string; label: string; hours: number; count: number }

const monthShort = new Intl.DateTimeFormat('sv-SE', { month: 'short' })

// Training time per week (Monday to Sunday) or month, from `from` to `to`,
// with empty periods included so gaps show.
export function periodRows(
  activities: Activity[],
  from: string,
  to: string,
  by: 'week' | 'month',
): PeriodRow[] {
  const keyOf = (date: string) => (by === 'week' ? mondayOf(date) : date.slice(0, 7))
  const rows = new Map<string, PeriodRow>()
  let cursor = by === 'week' ? mondayOf(from) : `${from.slice(0, 7)}-01`
  while (cursor <= to) {
    const key = keyOf(cursor)
    const [year, month] = key.split('-').map(Number)
    rows.set(key, {
      key,
      label:
        by === 'week'
          ? `v. ${isoWeek(key)}`
          : monthShort.format(new Date(year, month - 1, 1)).replace('.', ''),
      hours: 0,
      count: 0,
    })
    if (by === 'week') {
      cursor = addDays(cursor, 7)
    } else {
      const next = new Date(year, month, 1)
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
    }
  }
  for (const activity of activities) {
    const row = rows.get(keyOf(activity.date))
    if (!row || activity.date < from || activity.date > to) continue
    row.hours += activity.duration / 3600
    row.count += 1
  }
  return [...rows.values()]
}

export type SportRow = Totals & { type: string; label: string }

// Each sport's totals, the most trained first.
export function sportRows(activities: Activity[]): SportRow[] {
  const byLabel = new Map<string, Activity[]>()
  for (const activity of activities) {
    const label = sportLabel(activity.type)
    byLabel.set(label, [...(byLabel.get(label) ?? []), activity])
  }
  return [...byLabel.entries()]
    .map(([label, items]) => ({ label, type: items[0].type, ...totalsOf(items) }))
    .sort((a, b) => b.seconds - a.seconds)
}

// Key expiry -----------------------------------------------------------------

export const KEY_WARNING_DAYS = 14

// What, if anything, needs doing about the Garmin connection.
export function garminProblem(status: GarminStatus | null, today: string) {
  if (!status || status.state === 'not_configured') return null
  if (status.error === 'key_invalid') return 'key_invalid' as const
  if (status.keyExpires) {
    if (status.keyExpires <= today) return 'key_expired' as const
    if (status.keyExpires <= addDays(today, KEY_WARNING_DAYS)) return 'key_expiring' as const
  }
  if (status.state === 'error') return 'sync_failed' as const
  return null
}

export const garminErrorMessages: Record<GarminErrorCode, string> = {
  key_invalid:
    'Garmin nekade API-nyckeln. Skapa en ny i Garmin Connect och lägg in den i tjänsten.',
  rate_limited: 'Garmin bad oss vänta. Nästa försök görs om en timme.',
  unreachable: 'Kan inte nå Garmin just nu.',
  failed: 'Synkningen med Garmin misslyckades. Försök igen senare.',
}
