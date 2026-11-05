import { toRecord } from './classify.ts'
import type {
  MailRecord,
  MailSource,
  MailStatus,
  MailStore,
} from './types.ts'

const REFRESH_MS = 5 * 60_000
const CHANGE_DELAY_MS = 2_000

const key = (record: Pick<MailRecord, 'uidValidity' | 'uid'>) =>
  `${record.uidValidity}:${record.uid}`

// Fields that can change on an existing message, or when the rules change.
const CHANGEABLE = [
  'bucket',
  'seen',
  'sensitive',
  'bulk',
  'subject',
  'snippet',
  'threadId',
] as const

export type MailSync = ReturnType<typeof createMailSync>

// Keeps the stored inbox the same as the real one: new mail is added, read
// and re-sorted mail is updated, and mail that left the inbox is removed.
export function createMailSync(options: {
  source: MailSource
  store: MailStore
  account: string
  // Test hooks.
  refreshMs?: number
  changeDelayMs?: number
  now?: () => Date
}) {
  const { source, store, account } = options
  const now = options.now ?? (() => new Date())
  let status: MailStatus = {
    state: 'connecting',
    account,
    lastSync: null,
    count: 0,
    error: null,
  }
  let running = false
  let again = false
  let timer: ReturnType<typeof setInterval> | undefined
  let changeTimer: ReturnType<typeof setTimeout> | undefined

  async function syncOnce() {
    // Changes that arrive during a sync trigger one more pass afterwards.
    if (running) {
      again = true
      return
    }
    running = true
    try {
      do {
        again = false
        const messages = await source.fetchInbox()
        const wanted = new Map(messages.map((m) => [key(m), toRecord(m)]))
        const existing = await store.list()
        const stored = new Map(existing.map((r) => [key(r), r]))

        for (const [id, record] of wanted) {
          const current = stored.get(id)
          if (!current) {
            await store.create(record)
            continue
          }
          const changes: Partial<MailRecord> = {}
          for (const field of CHANGEABLE) {
            if (current[field] !== record[field]) {
              Object.assign(changes, { [field]: record[field] })
            }
          }
          if (Object.keys(changes).length > 0) {
            await store.update(current.id, changes)
          }
        }
        for (const [id, record] of stored) {
          if (!wanted.has(id)) await store.remove(record.id)
        }

        status = {
          state: 'connected',
          account,
          lastSync: now().toISOString(),
          count: wanted.size,
          error: null,
        }
      } while (again)
    } catch (error) {
      status = {
        ...status,
        state: 'error',
        error: error instanceof Error ? error.message : 'unknown error',
      }
      console.error('Mail sync failed:', status.error)
    } finally {
      running = false
    }
  }

  return {
    status: () => status,
    syncOnce,
    async start() {
      source.onChange(() => {
        // Several changes often come in a burst, so wait a moment.
        clearTimeout(changeTimer)
        changeTimer = setTimeout(
          () => void syncOnce(),
          options.changeDelayMs ?? CHANGE_DELAY_MS,
        )
      })
      try {
        await source.start()
      } catch (error) {
        status = {
          ...status,
          state: 'error',
          error: error instanceof Error ? error.message : 'unknown error',
        }
        console.error('Mail connection failed:', status.error)
      }
      await syncOnce()
      // A safety net in case a change notification is missed.
      timer = setInterval(() => void syncOnce(), options.refreshMs ?? REFRESH_MS)
    },
    async stop() {
      clearInterval(timer)
      clearTimeout(changeTimer)
      await source.stop()
    },
  }
}

// What the status endpoint reports when no mailbox is set up.
export const notConfigured: MailStatus = {
  state: 'not_configured',
  account: null,
  lastSync: null,
  count: 0,
  error: null,
}
