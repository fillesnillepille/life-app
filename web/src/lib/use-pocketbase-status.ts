import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'

export type PocketBaseStatus = 'checking' | 'connected' | 'unreachable'

async function checkPocketBase(): Promise<PocketBaseStatus> {
  try {
    await pb.health.check({ requestKey: null })
    return 'connected'
  } catch {
    return 'unreachable'
  }
}

export function usePocketBaseStatus() {
  const [status, setStatus] = useState<PocketBaseStatus>('checking')

  useEffect(() => {
    void checkPocketBase().then(setStatus)
  }, [])

  const retry = useCallback(() => {
    setStatus('checking')
    void checkPocketBase().then(setStatus)
  }, [])

  return { status, retry }
}
