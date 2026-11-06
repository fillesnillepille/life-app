import { useCallback, useEffect, useState } from 'react'
import type { DayRating, RatingValues } from '@/lib/day-rating'
import { pb } from '@/lib/pocketbase'

const collection = () => pb.collection('day_ratings')

function describeError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Något gick fel.'
}

// Every graded day, oldest first. One record a day stays small for years.
export function useDayRatings() {
  const [ratings, setRatings] = useState<DayRating[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await collection().getFullList<DayRating>({
        sort: 'date',
        requestKey: null,
      })
      setRatings(items)
      setLoadError(null)
    } catch (error) {
      setLoadError(`Kunde inte hämta dagsbetygen. ${describeError(error)}`)
    }
  }, [])

  useEffect(() => {
    const run = () => void load()
    run()
  }, [load])

  const retry = useCallback(() => {
    setLoadError(null)
    void load()
  }, [load])

  // Creates the day's grades, or updates them if the day is already graded.
  const save = useCallback(
    async (date: string, values: RatingValues, existingId?: string) => {
      const user = pb.authStore.record?.id
      if (!user) throw new Error('Du är inte inloggad.')
      try {
        const saved = existingId
          ? await collection().update<DayRating>(existingId, values, {
              requestKey: null,
            })
          : await collection().create<DayRating>(
              { ...values, date, user },
              { requestKey: null },
            )
        setRatings((current) =>
          [...(current ?? []).filter((item) => item.id !== saved.id), saved].sort(
            (a, b) => a.date.localeCompare(b.date),
          ),
        )
        return saved
      } catch (error) {
        throw new Error(`Kunde inte spara betyget. ${describeError(error)}`, {
          cause: error,
        })
      }
    },
    [],
  )

  return { ratings, loadError, retry, save }
}
