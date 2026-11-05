import { useCallback, useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase'
import type { Mail, MailStatus } from '@/lib/mail'
import { trashMail } from '@/lib/mail-api'
import { serviceErrorMessage, serviceRequest } from '@/lib/service'

const STATUS_REFRESH_MS = 60_000

// The mirrored inbox, kept fresh: PocketBase tells us when the service has
// added, changed, or removed mail.
export function useMails() {
  const [mails, setMails] = useState<Mail[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await pb.collection('mails').getFullList<Mail>({
        sort: '-date',
        requestKey: null,
      })
      setMails(items)
      setLoadError(null)
    } catch {
      setLoadError('Kunde inte hämta mejlen.')
    }
  }, [])

  useEffect(() => {
    const run = () => void load()
    run()

    // Several changes arrive in a burst, so reload once after they settle.
    let timer: number | undefined
    const unsubscribe = pb
      .collection('mails')
      .subscribe('*', () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(run, 500)
      })
      .catch(() => undefined)

    return () => {
      window.clearTimeout(timer)
      void unsubscribe.then((stop) => stop?.())
    }
  }, [load])

  const retry = useCallback(() => {
    setLoadError(null)
    void load()
  }, [load])

  // The message disappears at once and comes back if Gmail refuses.
  const trash = useCallback(
    async (mail: Mail) => {
      setActionError(null)
      setMails((current) => current?.filter((item) => item.id !== mail.id) ?? null)
      try {
        await trashMail(mail)
        return true
      } catch (error) {
        setActionError(`Kunde inte ta bort mejlet. ${serviceErrorMessage(error)}`)
        void load()
        return false
      }
    },
    [load],
  )

  return { mails, loadError, actionError, retry, trash }
}

// Whether the service is connected to Gmail, and when it last synced.
export function useMailStatus() {
  const [status, setStatus] = useState<MailStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await serviceRequest<MailStatus>('/mail/status')
        if (!cancelled) setStatus(next)
      } catch {
        // The page still shows the stored mail without a status line.
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

  return status
}
