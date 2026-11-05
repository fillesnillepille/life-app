export type Bucket =
  | 'important'
  | 'invoices'
  | 'deliveries'
  | 'bookings'
  | 'newsletters'
  | 'promotions'
  | 'codes'
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

// A whole message, fetched when it is opened. It is passed on to the browser
// and never stored.
export type MailBody = {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  text: string
  // The original HTML, which the app must sanitize before showing. Null when
  // the message has none.
  html: string | null
  attachments: Array<{ filename: string; size: number }>
  // True when the message was too large to read in full.
  truncated: boolean
}

// Raised when there is no connection to the mailbox right now.
export class MailUnavailableError extends Error {
  constructor() {
    super('mail_unavailable')
  }
}

// Raised when no mailbox is set up at all.
export class MailNotConfiguredError extends Error {
  constructor() {
    super('mail_not_configured')
  }
}

// What the HTTP routes use. Message functions return null or false when the
// message is gone, or when the mailbox has been reset since it was listed.
export interface MailService {
  status(): MailStatus
  read(uidValidity: number, uid: number): Promise<MailBody | null>
  markSeen(uidValidity: number, uid: number): Promise<boolean>
  // Moves the message to Gmail's Trash, which Gmail empties after 30 days.
  trash(uidValidity: number, uid: number): Promise<boolean>
}

// Where messages come from. The Gmail connection implements this, and so does
// the fake used in tests.
export interface MailSource {
  read(uidValidity: number, uid: number): Promise<MailBody | null>
  markSeen(uidValidity: number, uid: number): Promise<boolean>
  trash(uidValidity: number, uid: number): Promise<boolean>
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
