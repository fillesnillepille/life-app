import { useCallback, useEffect, useState } from 'react'
import type { Activity, GarminDay, GarminStatus } from '@/lib/garmin'
import { pb } from '@/lib/pocketbase'
import { serviceErrorMessage, serviceRequest } from '@/lib/service'

const STATUS_REFRESH_MS = 60_000

// Every stored record in a collection the service writes, kept fresh:
// PocketBase tells us when a sync has added or changed something. One
// person's activities and days stay small enough to load in full.
function useServiceCollection<T>(name: string, sort: string, what: string) {
  const [items, setItems] = useState<T[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await pb.collection(name).getFullList<T>({ sort, requestKey: null })
      setItems(rows)
      setLoadError(null)
    } catch {
      setLoadError(`Kunde inte hämta ${what}.`)
    }
  }, [name, sort, what])

  useEffect(() => {
    const run = () => void load()
    run()
    // A sync writes in a burst, so reload once after it settles.
    let timer: number | undefined
    const unsubscribe = pb
      .collection(name)
      .subscribe('*', () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(run, 800)
      })
      .catch(() => undefined)
    return () => {
      window.clearTimeout(timer)
      void unsubscribe.then((stop) => stop?.())
    }
  }, [load, name])

  const retry = useCallback(() => {
    setLoadError(null)
    void load()
  }, [load])

  return { items, loadError, retry }
}

// Every activity, oldest first.
export function useGarminActivities() {
  const { items, loadError, retry } = useServiceCollection<Activity>(
    'garmin_activities',
    'startedAt',
    'träningspassen',
  )
  return { activities: items, loadError, retry }
}

// Every day with sleep or health data, oldest first.
export function useGarminDays() {
  const { items, loadError, retry } = useServiceCollection<GarminDay>(
    'garmin_days',
    'date',
    'sömn- och hälsodatan',
  )
  return { days: items, loadError, retry }
}

// How the service's Garmin sync is doing, and a way to run one now.
export function useGarminStatus() {
  const [status, setStatus] = useState<GarminStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await serviceRequest<GarminStatus>('/garmin/status')
        if (!cancelled) setStatus(next)
      } catch {
        // The pages still show the stored data without a status line.
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), STATUS_REFRESH_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      setStatus(await serviceRequest<GarminStatus>('/garmin/sync', { method: 'POST' }))
    } catch (error) {
      setSyncError(serviceErrorMessage(error))
    } finally {
      setSyncing(false)
    }
  }, [])

  return { status, syncing, syncError, syncNow }
}
