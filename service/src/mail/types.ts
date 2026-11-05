export type Bucket =
  | 'important'
  | 'invoices'
  | 'deliveries'
  | 'bookings'
  | 'newsletters'
  | 'promotions'
  | 'other'

// A message as read from the mailbox, before it is sorted.
export type MailMessage = {
  uid: number
  uidValidity: number
  messageId: string
  // Gmail's thread id as a decimal string. Empty when the server has none.
  threadId: string
  fromAddress: string
  fromName: string
  subject: string
  // ISO 8601
  date: string
  // The start of the plain-text body, already trimmed. Empty when not read.
  body: string
  seen: boolean
  // Gmail labels such as "\\Important".
  labels: string[]
  headers: {
    listUnsubscribe: boolean
    listId: boolean
    precedence: string
    autoSubmitted: boolean
  }
}

// What the app stores and shows.
export type MailRecord = {
  uid: number
  uidValidity: number
  messageId: string
  threadId: string
  fromAddress: string
  fromName: string
  subject: string
  date: string
  snippet: string
  bucket: Bucket
  seen: boolean
  sensitive: boolean
  bulk: boolean
}

export type MailState = 'not_configured' | 'connecting' | 'connected' | 'error'

export type MailStatus = {
  state: MailState
  // The mailbox being read, so the app can link to the right Gmail account.
  account: string | null
  lastSync: string | null
  count: number
  error: string | null
}

// Where messages come from. The Gmail connection implements this, and so does
// the fake used in tests.
export interface MailSource {
  // The messages currently in the inbox, newest first.
  fetchInbox(): Promise<MailMessage[]>
  // Calls back when the inbox may have changed.
  onChange(listener: () => void): void
  start(): Promise<void>
  stop(): Promise<void>
}

// Where sorted messages are kept.
export interface MailStore {
  list(): Promise<Array<MailRecord & { id: string }>>
  create(record: MailRecord): Promise<void>
  update(id: string, changes: Partial<MailRecord>): Promise<void>
  remove(id: string): Promise<void>
}
