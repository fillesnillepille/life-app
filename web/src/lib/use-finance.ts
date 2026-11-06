import { useCallback, useEffect, useState } from 'react'
import type { FinanceMonth, FinanceValues } from '@/lib/finance'
import { pb } from '@/lib/pocketbase'

const collection = () => pb.collection('finance_months')

function describeError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Något gick fel.'
}

// All months, oldest first.
export function useFinanceMonths() {
  const [months, setMonths] = useState<FinanceMonth[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await collection().getFullList<FinanceMonth>({
        sort: 'month',
        requestKey: null,
      })
      setMonths(items)
      setLoadError(null)
    } catch (error) {
      setLoadError(`Kunde inte hämta ekonomin. ${describeError(error)}`)
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

  // Creates the month, or updates it if it's already saved.
  const save = useCallback(
    async (month: string, values: FinanceValues, existingId?: string) => {
      const user = pb.authStore.record?.id
      if (!user) throw new Error('Du är inte inloggad.')
      try {
        const saved = existingId
          ? await collection().update<FinanceMonth>(existingId, values, {
              requestKey: null,
            })
          : await collection().create<FinanceMonth>(
              { ...values, month, user },
              { requestKey: null },
            )
        setMonths((current) =>
          [...(current ?? []).filter((item) => item.id !== saved.id), saved].sort(
            (a, b) => a.month.localeCompare(b.month),
          ),
        )
      } catch (error) {
        throw new Error(`Kunde inte spara. ${describeError(error)}`, {
          cause: error,
        })
      }
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    try {
      await collection().delete(id, { requestKey: null })
      setMonths((current) => current?.filter((item) => item.id !== id) ?? null)
    } catch (error) {
      throw new Error(`Kunde inte ta bort. ${describeError(error)}`, {
        cause: error,
      })
    }
  }, [])

  return { months, loadError, retry, save, remove }
}
