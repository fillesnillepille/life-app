import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { MailMessage, MailSource } from './types.ts'

const SNIPPET_LENGTH = 400
// Enough to cover the headers and the start of the text without downloading
// attachments.
const SOURCE_BYTES = 40_000
const RECONNECT_MIN_MS = 5_000
const RECONNECT_MAX_MS = 15 * 60_000

// Turns a body into a short plain snippet: quoted replies and links removed,
// whitespace collapsed.
export function makeSnippet(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('>'))
    .join(' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SNIPPET_LENGTH)
}

type Details = Pick<
  MailMessage,
  | 'messageId'
  | 'fromAddress'
  | 'fromName'
  | 'subject'
  | 'date'
  | 'body'
  | 'headers'
>

// Reads Gmail's inbox over IMAP with an app password, and keeps the connection
// open so Gmail can tell us the moment something changes.
export function createGmailSource(options: {
  user: string
  password: string
  host?: string
  port?: number
  // Only mail from the last days is mirrored, and at most this many messages.
  lookbackDays?: number
  limit?: number
}): MailSource {
  const lookbackDays = options.lookbackDays ?? 30
  const limit = options.limit ?? 300
  const listeners: Array<() => void> = []
  let client: ImapFlow | undefined
  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryDelay = RECONNECT_MIN_MS
  // The slow part is reading the body, so each message is read once.
  const details = new Map<number, Details>()
  let validity = 0

  const notify = () => listeners.forEach((listener) => listener())

  function scheduleReconnect() {
    if (stopped) return
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      connect()
        .then(() => {
          retryDelay = RECONNECT_MIN_MS
          notify()
        })
        .catch((error: { authenticationFailed?: boolean; message?: string }) => {
          console.error('Gmail reconnect failed:', error.message)
          // A wrong password won't fix itself, and retrying risks a lockout.
          if (error.authenticationFailed) return
          retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS)
          scheduleReconnect()
        })
    }, retryDelay)
  }

  async function connect() {
    const next = new ImapFlow({
      host: options.host ?? 'imap.gmail.com',
      port: options.port ?? 993,
      secure: true,
      auth: { user: options.user, pass: options.password },
      logger: false,
    })
    // Without a listener, a connection error would crash the whole service.
    next.on('error', (error: Error) => {
      console.error('Gmail connection error:', error.message)
    })
    next.on('close', () => {
      if (client === next) client = undefined
      scheduleReconnect()
    })
    next.on('exists', notify)
    next.on('expunge', notify)
    next.on('flags', notify)
    await next.connect()
    await next.mailboxOpen('INBOX')
    client = next
  }

  async function readDetails(source: Buffer): Promise<Details> {
    const parsed = await simpleParser(source)
    const from = parsed.from?.value[0]
    const header = (name: string) => parsed.headers.get(name)
    return {
      messageId: parsed.messageId ?? '',
      fromAddress: from?.address ?? '',
      fromName: from?.name ?? '',
      subject: parsed.subject ?? '',
      date: (parsed.date ?? new Date()).toISOString(),
      body: makeSnippet(parsed.text ?? ''),
      headers: {
        listUnsubscribe: header('list-unsubscribe') !== undefined,
        listId: header('list-id') !== undefined,
        precedence: String(header('precedence') ?? ''),
        autoSubmitted:
          String(header('auto-submitted') ?? 'no').toLowerCase() !== 'no',
      },
    }
  }

  return {
    onChange(listener) {
      listeners.push(listener)
    },

    async start() {
      stopped = false
      try {
        await connect()
      } catch (error) {
        const failure = error as { authenticationFailed?: boolean }
        if (!failure.authenticationFailed) scheduleReconnect()
        throw error
      }
    },

    async stop() {
      stopped = true
      clearTimeout(retryTimer)
      await client?.logout().catch(() => {})
      client = undefined
    },

    async fetchInbox() {
      const active = client
      if (!active?.usable) throw new Error('Not connected to Gmail')

      const lock = await active.getMailboxLock('INBOX')
      try {
        const mailbox = active.mailbox
        const uidValidity = mailbox ? Number(mailbox.uidValidity) : 0
        if (uidValidity !== validity) {
          details.clear()
          validity = uidValidity
        }

        const since = new Date(Date.now() - lookbackDays * 86_400_000)
        const found = (await active.search({ since }, { uid: true })) || []
        const uids = found.sort((a, b) => a - b).slice(-limit)
        if (uids.length === 0) return []

        // Read the text of messages we haven't seen before.
        const fresh = uids.filter((uid) => !details.has(uid))
        if (fresh.length > 0) {
          for await (const message of active.fetch(
            fresh,
            { uid: true, source: { maxLength: SOURCE_BYTES } },
            { uid: true },
          )) {
            if (message.source) {
              details.set(message.uid, await readDetails(message.source))
            }
          }
        }

        // Flags and labels change over time, so they are read every time.
        const result: MailMessage[] = []
        for await (const message of active.fetch(
          uids,
          { uid: true, flags: true, labels: true, threadId: true },
          { uid: true },
        )) {
          const known = details.get(message.uid)
          if (!known) continue
          result.push({
            uid: message.uid,
            uidValidity,
            threadId: message.threadId ?? '',
            seen: message.flags?.has('\\Seen') ?? false,
            labels: [...(message.labels ?? [])],
            ...known,
          })
        }

        const present = new Set(uids)
        for (const uid of details.keys()) {
          if (!present.has(uid)) details.delete(uid)
        }
        return result.sort((a, b) => b.date.localeCompare(a.date))
      } finally {
        lock.release()
      }
    },
  }
}
