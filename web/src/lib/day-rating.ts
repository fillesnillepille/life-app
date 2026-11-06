// Grading how a day went, 1-5 in a few areas, and the average and smiley that
// come out of it.

import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react'
import { addDays, daysBetween, todayKey } from '@/lib/schedule'

export type GradeKey =
  | 'work'
  | 'exercise'
  | 'food'
  | 'social'
  | 'creativity'
  | 'general'

export type DayRating = {
  id: string
  date: string
  // Whether work was graded. When false, `work` is 0.
  worked: boolean
  comment: string
} & Record<GradeKey, number>

export type RatingValues = Omit<DayRating, 'id' | 'date'>

export const grades: {
  key: GradeKey
  label: string
  hint: string
  // Allmänt counts double in the average.
  weight: number
}[] = [
  { key: 'work', label: 'Arbete', hint: 'Hur gick jobbet?', weight: 1 },
  { key: 'exercise', label: 'Träning', hint: 'Rörde du på dig?', weight: 1 },
  { key: 'food', label: 'Mat', hint: 'Åt du bra?', weight: 1 },
  { key: 'social', label: 'Socialt', hint: 'Träffade eller pratade du med någon?', weight: 1 },
  { key: 'creativity', label: 'Kreativitet', hint: 'Skapade du något?', weight: 1 },
  { key: 'general', label: 'Allmänt', hint: 'Hur var dagen överlag? Räknas dubbelt.', weight: 2 },
]

export const gradeLabel = (key: GradeKey) =>
  grades.find((grade) => grade.key === key)?.label ?? key

// The weighted average of the grades given. Arbete only counts on days it was
// graded.
export function averageOf(rating: Pick<DayRating, GradeKey | 'worked'>) {
  let sum = 0
  let weights = 0
  for (const grade of grades) {
    if (grade.key === 'work' && !rating.worked) continue
    const value = rating[grade.key]
    if (!value) continue
    sum += value * grade.weight
    weights += grade.weight
  }
  return weights ? sum / weights : 0
}

export type Mood = { level: number; icon: LucideIcon; label: string }

export const moods: Mood[] = [
  { level: 1, icon: Frown, label: 'Dålig dag' },
  { level: 2, icon: Annoyed, label: 'Sämre dag' },
  { level: 3, icon: Meh, label: 'Okej dag' },
  { level: 4, icon: Smile, label: 'Bra dag' },
  { level: 5, icon: Laugh, label: 'Mycket bra dag' },
]

// The smiley for an average: under 1.5 is the saddest, 4.5 and up the
// happiest, and each step between is one point wide.
export function moodOf(average: number) {
  const level = Math.min(5, Math.max(1, Math.round(average)))
  return moods[level - 1]
}

const averageFormat = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

// "3,8"
export const formatAverage = (value: number) => averageFormat.format(value)

// The prompt on Idag shows from this hour until the day is graded.
export const promptHour = 19

// Only today and yesterday can be graded or changed, so a day isn't re-graded
// weeks later from memory.
export function canRate(date: string, now: number) {
  const today = todayKey(now)
  return date === today || date === addDays(today, -1)
}

// The day the prompt on Idag should ask about, or null: today from the
// evening, otherwise yesterday if it was missed.
export function dayToPrompt(ratedDates: Set<string>, now: number) {
  const today = todayKey(now)
  const yesterday = addDays(today, -1)
  if (new Date(now).getHours() >= promptHour && !ratedDates.has(today)) {
    return today
  }
  return ratedDates.has(yesterday) ? null : yesterday
}

// Chart rows -----------------------------------------------------------------

export type Row = {
  date: string
  // null on days that weren't graded.
  value: number | null
  rolling: number | null
}

// One row per day from `from` to `to`, with a value from `pick` and the
// average of the graded days in the 7 days up to it.
export function dailyRows(
  ratings: DayRating[],
  from: string,
  to: string,
  pick: (rating: DayRating) => number | null,
): Row[] {
  const byDate = new Map(ratings.map((rating) => [rating.date, rating]))
  const values: (number | null)[] = []
  const rows: Row[] = []
  const length = daysBetween(from, to) + 1
  for (let index = 0; index < length; index += 1) {
    const date = addDays(from, index)
    const rating = byDate.get(date)
    const value = rating ? pick(rating) : null
    values.push(value)
    const window = values.slice(-7).filter((item): item is number => item !== null)
    rows.push({
      date,
      value,
      rolling: window.length
        ? window.reduce((sum, item) => sum + item, 0) / window.length
        : null,
    })
  }
  return rows
}
