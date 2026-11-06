import { useEffect, useState } from 'react'
import { serviceRequest } from '@/lib/service'

export type AiStatus = {
  state: 'ready' | 'not_configured'
  // "2026-12-06", or null if the service wasn't told.
  keyExpires: string | null
}

// How many days before the key runs out the reminder starts.
export const AI_KEY_WARNING_DAYS = 7

// 'expired' from the day it runs out, 'expiring' during the week before.
export function aiKeyProblem(
  status: AiStatus | null,
  today: string,
  addDays: (key: string, days: number) => string,
) {
  if (!status || status.state === 'not_configured' || !status.keyExpires) {
    return null
  }
  if (status.keyExpires <= today) return 'expired' as const
  if (status.keyExpires <= addDays(today, AI_KEY_WARNING_DAYS)) {
    return 'expiring' as const
  }
  return null
}

// Checks once when the page opens. The reminder is not urgent enough to poll.
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    serviceRequest<AiStatus>('/chat/status')
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        // No reminder if the service can't be reached.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
