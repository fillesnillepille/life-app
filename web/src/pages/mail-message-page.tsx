import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  Paperclip,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Loading, LoadError } from '@/components/load-status'
import { MailHtml, MailText } from '@/components/mail-content'
import { Panel } from '@/components/panel'
import { TrashMailDialog } from '@/components/trash-mail-dialog'
import { Button } from '@/components/ui/button'
import {
  bucketLabels,
  gmailLink,
  parseDate,
  type Mail,
  type MailBody,
} from '@/lib/mail'
import { markMailSeen, readMail, trashMail } from '@/lib/mail-api'
import { pb } from '@/lib/pocketbase'
import { ServiceError, serviceErrorMessage } from '@/lib/service'
import { useMailStatus } from '@/lib/use-mails'

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'long',
  timeStyle: 'short',
})

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

type Loaded = { body: MailBody; mail: Mail | null }

// One message, read in the app. The text comes from Gmail when the page opens
// and is not stored anywhere.
export function MailMessagePage() {
  const params = useParams()
  const uidValidity = Number(params.uidValidity)
  const uid = Number(params.uid)
  const valid = Number.isInteger(uidValidity) && Number.isInteger(uid)

  const navigate = useNavigate()
  const status = useMailStatus()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(
    valid ? null : { message: 'Mejlet finns inte.', gone: true },
  )
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<'text' | 'original'>('text')
  const [showImages, setShowImages] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    const ref = { uidValidity, uid }

    async function load() {
      try {
        const [body, mail] = await Promise.all([
          readMail(ref),
          // The stored copy knows the Gmail link and whether it was read.
          pb
            .collection('mails')
            .getFirstListItem<Mail>(
              pb.filter('uidValidity = {:v} && uid = {:u}', {
                v: uidValidity,
                u: uid,
              }),
              { requestKey: null },
            )
            .catch(() => null),
        ])
        if (cancelled) return
        setLoaded({ body, mail })
        setError(null)
        // Opening a message reads it, as in Gmail.
        if (!mail || !mail.seen) void markMailSeen(ref).catch(() => undefined)
      } catch (failure) {
        if (cancelled) return
        setError({
          message: serviceErrorMessage(failure),
          gone: failure instanceof ServiceError && failure.code === 'mail_not_found',
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [valid, uidValidity, uid, attempt])

  async function trash() {
    setConfirmOpen(false)
    setActionError(null)
    try {
      await trashMail({ uidValidity, uid })
      navigate('/mejl', { replace: true })
    } catch (failure) {
      setActionError(`Kunde inte ta bort mejlet. ${serviceErrorMessage(failure)}`)
    }
  }

  const body = loaded?.body
  const mail = loaded?.mail ?? null
  const hasOriginal = Boolean(body?.html)
  const subject = body?.subject ?? ''
  const sender = body ? body.fromName || body.fromAddress : ''

  return (
    <section className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="h-11 lg:h-8"
          render={<Link to="/mejl" />}
          nativeButton={false}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Mejl
        </Button>
        {body && (
          <div className="flex items-center gap-2">
            {mail && (
              <Button
                variant="outline"
                className="h-11 lg:h-8"
                render={
                  <a
                    href={gmailLink(mail, status?.account ?? null)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <ExternalLink data-icon="inline-start" aria-hidden />
                Öppna i Gmail
              </Button>
            )}
            <Button
              variant="destructive"
              className="h-11 lg:h-8"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              Ta bort
            </Button>
          </div>
        )}
      </div>

      {!loaded && !error && <Loading>Hämtar mejlet…</Loading>}

      {error && (
        <div className="rounded-xl border">
          <LoadError
            message={error.message}
            onRetry={
              error.gone ? () => navigate('/mejl') : () => setAttempt((n) => n + 1)
            }
          />
        </div>
      )}

      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {body && (
        <Panel
          title={mail ? bucketLabels[mail.bucket] : 'Mejl'}
          meta={dateFormat.format(parseDate(body.date))}
        >
          <header className="space-y-1 border-b p-3">
            <h1 className="text-base font-semibold break-words">
              {subject || '(inget ämne)'}
            </h1>
            <p className="text-sm text-muted-foreground break-words">
              {sender}
              {body.fromName && body.fromAddress && (
                <span> &lt;{body.fromAddress}&gt;</span>
              )}
            </p>
          </header>

          {hasOriginal && (
            <div className="flex flex-wrap items-center gap-2 border-b p-2">
              <Button
                variant={view === 'text' ? 'secondary' : 'ghost'}
                className="h-11 lg:h-8"
                onClick={() => setView('text')}
                aria-pressed={view === 'text'}
              >
                Text
              </Button>
              <Button
                variant={view === 'original' ? 'secondary' : 'ghost'}
                className="h-11 lg:h-8"
                onClick={() => setView('original')}
                aria-pressed={view === 'original'}
              >
                Originalutseende
              </Button>
              {view === 'original' && (
                <Button
                  variant={showImages ? 'secondary' : 'ghost'}
                  className="h-11 lg:h-8"
                  onClick={() => setShowImages((value) => !value)}
                  aria-pressed={showImages}
                >
                  <ImageIcon data-icon="inline-start" aria-hidden />
                  {showImages ? 'Dölj bilder' : 'Visa bilder'}
                </Button>
              )}
            </div>
          )}

          <div className="p-3">
            {view === 'original' && body.html ? (
              <div className="space-y-2">
                {!showImages && (
                  <p className="text-xs text-muted-foreground">
                    Bilder från internet är avstängda, så avsändaren inte får
                    veta att du läst mejlet.
                  </p>
                )}
                <MailHtml html={body.html} showImages={showImages} />
              </div>
            ) : body.text ? (
              <MailText text={body.text} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Mejlet har ingen text att visa.
              </p>
            )}
            {body.truncated && (
              <p className="mt-3 text-xs text-muted-foreground">
                Mejlet var för stort för att visas helt. Öppna det i Gmail för
                resten.
              </p>
            )}
          </div>

          {body.attachments.length > 0 && (
            <div className="border-t p-3">
              <h2 className="text-xs tracking-widest text-muted-foreground uppercase">
                Bilagor
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {body.attachments.map((attachment, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Paperclip
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{attachment.filename}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatSize(attachment.size)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Öppna mejlet i Gmail för att ladda ner bilagor.
              </p>
            </div>
          )}
        </Panel>
      )}

      <TrashMailDialog
        subject={subject}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void trash()}
      />
    </section>
  )
}
