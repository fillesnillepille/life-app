import { useCallback, useEffect, useRef, useState } from 'react'
import { serviceErrorMessage, serviceRequest } from '@/lib/service'

export type Light = {
  id: string
  name: string
  on: boolean
  available: boolean
  supportsBrightness: boolean
  brightness: number | null
}

export type Scene = { id: string; name: string }

type LightsResponse = { lights: Light[]; scenes: Scene[] }

const POLL_MS = 5000
// A light takes a moment to report its new state, so a poll right after a
// change could briefly undo what the user just did.
const SETTLE_MS = 1500

export function useLights() {
  const [data, setData] = useState<LightsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lastChange = useRef(0)
  const pendingChanges = useRef(0)

  const load = useCallback(async () => {
    const started = Date.now()
    try {
      const next = await serviceRequest<LightsResponse>('/lights')
      const settled =
        pendingChanges.current === 0 &&
        lastChange.current + SETTLE_MS <= started
      if (settled) setData(next)
      setLoadError(null)
    } catch (error) {
      setLoadError(serviceErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') void load()
    }
    poll()
    const timer = window.setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [load])

  const runChange = useCallback(
    async (change: () => Promise<void>) => {
      pendingChanges.current += 1
      setActionError(null)
      try {
        await change()
      } catch (error) {
        setActionError(serviceErrorMessage(error))
        lastChange.current = 0
        pendingChanges.current -= 1
        await load()
        return
      }
      lastChange.current = Date.now()
      pendingChanges.current -= 1
      window.setTimeout(() => void load(), SETTLE_MS)
    },
    [load],
  )

  const setLight = useCallback(
    (id: string, on: boolean, brightness?: number) => {
      setData((current) =>
        current && {
          ...current,
          lights: current.lights.map((light) =>
            light.id === id
              ? { ...light, on, brightness: brightness ?? light.brightness }
              : light,
          ),
        },
      )
      return runChange(() =>
        serviceRequest<void>(`/lights/${id}`, {
          method: 'POST',
          body: brightness === undefined ? { on } : { on, brightness },
        }),
      )
    },
    [runChange],
  )

  const activateScene = useCallback(
    (id: string) =>
      runChange(() =>
        serviceRequest<void>(`/scenes/${id}/activate`, { method: 'POST' }),
      ),
    [runChange],
  )

  return {
    lights: data?.lights ?? null,
    scenes: data?.scenes ?? [],
    loadError,
    actionError,
    retry: load,
    setLight,
    activateScene,
  }
}
