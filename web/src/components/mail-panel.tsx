import { Link } from 'react-router'
import { Loading, LoadError } from '@/components/load-status'
import { MailRow } from '@/components/mail-row'
import { Panel } from '@/components/panel'
import { actionBuckets, bucketLabels, describeMailStatus } from '@/lib/mail'
import { useMails, useMailStatus } from '@/lib/use-mails'

const MAX_ROWS = 5

// A short list of unread mail that may need something from you. Newsletters
// and ads are left out, so what's here is worth a look.
export function MailPanel() {
  const { mails, loadError, retry } = useMails()
  const status = useMailStatus()

  if (status?.state === 'not_configured') {
    return (
      <Panel title="Post">
        <p className="p-3 text-sm text-muted-foreground">
          {describeMailStatus(status)}
        </p>
      </Panel>
    )
  }

  if (!mails) {
    return (
      <Panel title="Post">
        {loadError ? (
          <LoadError message={loadError} onRetry={retry} />
        ) : (
          <Loading>Hämtar mejlen…</Loading>
        )}
      </Panel>
    )
  }

  const worthALook = mails.filter(
    (mail) => !mail.seen && actionBuckets.includes(mail.bucket),
  )
  const shown = worthALook.slice(0, MAX_ROWS)

  return (
    <Panel
      title="Post"
      meta={`${worthALook.length} ${worthALook.length === 1 ? 'oläst' : 'olästa'}`}
    >
      {status?.state === 'error' && (
        <p className="border-b p-3 text-sm text-destructive" role="alert">
          {describeMailStatus(status)}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          Inget nytt som väntar på dig.
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((mail) => (
            <MailRow
              key={mail.id}
              mail={mail}
              account={status?.account ?? null}
              showSnippet={false}
              tag={bucketLabels[mail.bucket]}
            />
          ))}
        </ul>
      )}
      <div className="border-t p-3 text-sm">
        <Link
          to="/mejl"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {worthALook.length > shown.length
            ? `Visa alla ${worthALook.length} och resten av inkorgen`
            : 'Öppna Mejl'}
        </Link>
      </div>
    </Panel>
  )
}
