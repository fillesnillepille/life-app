export type Bucket =
  | 'important'
  | 'invoices'
  | 'deliveries'
  | 'bookings'
  | 'newsletters'
  | 'promotions'
  | 'codes'
  | 'other'

export type Mail = {
  id: string
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
}

export type MailStatus = {
  state: 'not_configured' | 'connecting' | 'connected' | 'error'
  account: string | null
  lastSync: string | null
  count: number
  error: string | null
}

export const bucketLabels: Record<Bucket, string> = {
  important: 'Viktigt',
  invoices: 'Fakturor',
  deliveries: 'Leveranser',
  bookings: 'Bokningar',
  other: 'Övrigt',
  codes: 'Koder',
  newsletters: 'Nyhetsbrev',
  promotions: 'Reklam',
}

// The order buckets are shown in: what needs attention first.
export const bucketOrder: Bucket[] = [
  'important',
  'codes',
  'invoices',
  'deliveries',
  'bookings',
  'other',
  'newsletters',
  'promotions',
]

// The buckets that can need action, as opposed to reading material and ads.
export const actionBuckets: Bucket[] = [
  'important',
  'invoices',
  'deliveries',
  'bookings',
]

// A whole message, fetched from Gmail through the service when it is opened.
export type MailBody = {
  subject: string
  fromName: string
  fromAddress: string
  date: string
  text: string
  html: string | null
  attachments: Array<{ filename: string; size: number }>
  truncated: boolean
}

// Where a message is opened in the app.
export function mailPath(mail: Pick<Mail, 'uidValidity' | 'uid'>) {
  return `/mejl/${mail.uidValidity}/${mail.uid}`
}

// PocketBase writes dates as "2026-11-05 21:24:52.883Z"; Safari needs the "T".
export function parseDate(value: string) {
  return new Date(value.replace(' ', 'T'))
}

export function senderName(mail: Mail) {
  return mail.fromName || mail.fromAddress || 'Okänd avsändare'
}

// A link that opens the message in Gmail. Gmail's thread id is a decimal
// number in the mailbox and hexadecimal in the web address.
export function gmailLink(mail: Mail, account: string | null) {
  const user = account ? `?authuser=${encodeURIComponent(account)}` : ''
  if (/^\d+$/.test(mail.threadId)) {
    return `https://mail.google.com/mail/${user}#all/${BigInt(mail.threadId).toString(16)}`
  }
  return `https://mail.google.com/mail/${user}#search/${encodeURIComponent(`rfc822msgid:${mail.messageId}`)}`
}

const timeFormat = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
})
const dayFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
})
const yearFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Today's mail shows the time, older mail the date.
export function formatMailDate(value: string, now: Date = new Date()) {
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return ''
  if (date.toDateString() === now.toDateString()) return timeFormat.format(date)
  return (date.getFullYear() === now.getFullYear() ? dayFormat : yearFormat).format(
    date,
  )
}

const syncTimeFormat = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
})

// A one-line description of the connection to Gmail, or null while unknown.
export function describeMailStatus(status: MailStatus | null) {
  if (!status) return null
  switch (status.state) {
    case 'not_configured':
      return 'Mejl är inte kopplat än.'
    case 'connecting':
      return 'Ansluter till Gmail…'
    case 'error':
      return 'Synkroniseringen med Gmail misslyckades. Det som visas kan vara gammalt.'
    case 'connected':
      return status.lastSync
        ? `Uppdaterad ${syncTimeFormat.format(new Date(status.lastSync))}`
        : 'Ansluten till Gmail.'
  }
}
