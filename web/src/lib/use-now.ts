import { useEffect, useState } from 'react'

// The current time, refreshed every minute so the daily list's "older than a
// day" flags and "finished today" filter stay right on a page left open.
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
