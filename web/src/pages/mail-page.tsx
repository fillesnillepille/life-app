import { useState } from 'react'
import { Loading, LoadError } from '@/components/load-status'
import { MailRow } from '@/components/mail-row'
import { Panel } from '@/components/panel'
import { TrashMailDialog } from '@/components/trash-mail-dialog'
import { Button } from '@/components/ui/button'
import {
  bucketLabels,
  bucketOrder,
  describeMailStatus,
  type Bucket,
  type Mail,
} from '@/lib/mail'
import { useMails, useMailStatus } from '@/lib/use-mails'

const SHOWN = 8

export function MailPage() {
  const { mails, loadError, actionError, retry, trash } = useMails()
  const status = useMailStatus()
  const account = status?.account ?? null
  const statusLine = describeMailStatus(status)

  // The message waiting for the user to confirm. It stays set while the dialog
  // fades out, so the text doesn't blank during the animation.
  const [target, setTarget] = useState<Mail | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function askToTrash(mail: Mail) {
    setTarget(mail)
    setConfirmOpen(true)
  }

  return (
    <section className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Mejl</h1>
        {statusLine && (
          <p
            className={
              status?.state === 'error'
                ? 'mt-1 text-sm text-destructive'
                : 'mt-1 text-sm text-muted-foreground'
            }
            role={status?.state === 'error' ? 'alert' : 'status'}
          >
            {account && status?.state === 'connected'
              ? `${account} · ${statusLine}`
              : statusLine}
          </p>
        )}
      </header>

      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {loadError && !mails && (
        <div className="rounded-xl border">
          <LoadError message={loadError} onRetry={retry} />
        </div>
      )}
      {!mails && !loadError && <Loading>Hämtar mejlen…</Loading>}

      {mails && mails.length === 0 && status?.state !== 'not_configured' && (
        <p className="text-sm text-muted-foreground">Inkorgen är tom.</p>
      )}

      {mails &&
        bucketOrder.map((bucket) => (
          <BucketPanel
            key={bucket}
            bucket={bucket}
            mails={mails.filter((mail) => mail.bucket === bucket)}
            onDelete={askToTrash}
          />
        ))}

      <TrashMailDialog
        subject={target?.subject ?? ''}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          if (target) void trash(target)
          setConfirmOpen(false)
        }}
      />
    </section>
  )
}

function BucketPanel({
  bucket,
  mails,
  onDelete,
}: {
  bucket: Bucket
  mails: Mail[]
  onDelete: (mail: Mail) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (mails.length === 0) return null

  const unread = mails.filter((mail) => !mail.seen).length
  const shown = expanded ? mails : mails.slice(0, SHOWN)

  return (
    <Panel
      title={bucketLabels[bucket]}
      meta={`${mails.length} · ${unread} ${unread === 1 ? 'oläst' : 'olästa'}`}
    >
      <ul className="divide-y">
        {shown.map((mail) => (
          <MailRow
            key={mail.id}
            mail={mail}
            onDelete={onDelete}
            // Ads, newsletters, and codes are for skimming, so a line is
            // enough. Codes have no snippet at all.
            showSnippet={
              bucket !== 'promotions' &&
              bucket !== 'newsletters' &&
              bucket !== 'codes'
            }
          />
        ))}
      </ul>
      {mails.length > SHOWN && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="h-11 w-full lg:h-8"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Visa färre' : `Visa alla ${mails.length}`}
          </Button>
        </div>
      )}
    </Panel>
  )
}
