import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMailDate, mailPath, senderName, type Mail } from '@/lib/mail'
import { cn } from '@/lib/utils'

// One message in a list. It opens the message in the app, and can have a
// delete button beside it.
export function MailRow({
  mail,
  showSnippet = true,
  tag,
  onDelete,
}: {
  mail: Mail
  showSnippet?: boolean
  // A small label above the sender, used where buckets are mixed.
  tag?: string
  onDelete?: (mail: Mail) => void
}) {
  return (
    <li className="flex items-center pr-1">
      <Link
        to={mailPath(mail)}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-3 px-3 py-2 text-sm hover:bg-accent"
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
      </Link>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground lg:size-8"
          aria-label={`Ta bort ${mail.subject || 'mejlet'}`}
          onClick={() => onDelete(mail)}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  )
}
