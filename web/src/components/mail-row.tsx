import { ExternalLink } from 'lucide-react'
import {
  formatMailDate,
  gmailLink,
  senderName,
  type Mail,
} from '@/lib/mail'
import { cn } from '@/lib/utils'

// One message in a list. It links to the message in Gmail, since reading and
// replying happen there.
export function MailRow({
  mail,
  account,
  showSnippet = true,
  tag,
}: {
  mail: Mail
  account: string | null
  showSnippet?: boolean
  // A small label before the sender, used where buckets are mixed.
  tag?: string
}) {
  return (
    <li>
      <a
        href={gmailLink(mail, account)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-start gap-3 px-3 py-2 text-sm hover:bg-accent"
      >
        {mail.seen ? (
          <span className="mt-1.5 size-2 shrink-0" aria-hidden />
        ) : (
          <span
            role="img"
            aria-label="Oläst"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {tag && (
            <span className="text-[10px] tracking-widest text-primary uppercase">
              {tag}
            </span>
          )}
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn('truncate', !mail.seen && 'font-semibold')}>
              {senderName(mail)}
            </span>
            <time
              dateTime={mail.date}
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
            >
              {formatMailDate(mail.date)}
            </time>
          </span>
          <span className={cn('truncate', mail.seen && 'text-muted-foreground')}>
            {mail.subject || '(inget ämne)'}
          </span>
          {showSnippet && mail.snippet && (
            <span className="truncate text-xs text-muted-foreground">
              {mail.snippet}
            </span>
          )}
        </span>
        <ExternalLink
          className="mt-1 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">Öppnas i Gmail</span>
      </a>
    </li>
  )
}
