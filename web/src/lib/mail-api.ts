import type { MailBody } from '@/lib/mail'
import { serviceRequest } from '@/lib/service'

// Calls to the service for single messages. A message is named by the
// mailbox's validity number and its UID, the same pair the app stores.
type Ref = { uidValidity: number; uid: number }

const path = ({ uidValidity, uid }: Ref) =>
  `/mail/messages/${uidValidity}/${uid}`

export const readMail = (ref: Ref) => serviceRequest<MailBody>(path(ref))

export const markMailSeen = (ref: Ref) =>
  serviceRequest<void>(`${path(ref)}/seen`, { method: 'POST' })

// Moves the message to Gmail's Trash, which Gmail empties after 30 days.
export const trashMail = (ref: Ref) =>
  serviceRequest<void>(`${path(ref)}/trash`, { method: 'POST' })
