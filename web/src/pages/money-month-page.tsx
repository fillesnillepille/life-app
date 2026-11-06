import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CircleAlert, Trash2 } from 'lucide-react'
import { Loading, LoadError } from '@/components/load-status'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  amountText,
  dueMonthKey,
  formatKronor,
  formatMonth,
  isMonthKey,
  parseAmount,
  previousMonthKey,
  type FinanceMonth,
  type FinanceValues,
} from '@/lib/finance'
import { useFinanceMonths } from '@/lib/use-finance'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

type FieldId = 'expenses' | 'savings' | 'investments' | 'deposited'

const fields: {
  id: FieldId
  label: string
  hint: string
  optional?: boolean
  allowNegative?: boolean
}[] = [
  {
    id: 'expenses',
    label: 'Utgifter',
    hint: 'Vad du gjorde av med under månaden.',
  },
  {
    id: 'savings',
    label: 'Sparande',
    hint: 'Saldot på sparkontona vid månadens slut.',
  },
  {
    id: 'investments',
    label: 'Investeringar',
    hint: 'Vad fonder och aktier är värda vid månadens slut.',
  },
  {
    id: 'deposited',
    label: 'Insatt i investeringar',
    hint: 'Valfritt. Hur mycket du satte in under månaden, med minus om du tog ut. Gör att avkastningen kan räknas fram.',
    optional: true,
    allowNegative: true,
  },
]

function MonthForm({
  month,
  existing,
  previous,
  onSave,
  onRemove,
}: {
  month: string
  existing?: FinanceMonth
  previous?: FinanceMonth
  onSave: (values: FinanceValues) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [text, setText] = useState<Record<FieldId, string>>(() => ({
    expenses: existing ? amountText(existing.expenses) : '',
    savings: existing ? amountText(existing.savings) : '',
    investments: existing ? amountText(existing.investments) : '',
    deposited:
      existing && existing.deposited !== 0 ? amountText(existing.deposited) : '',
  }))
  const [note, setNote] = useState(existing?.note ?? '')
  const [invalid, setInvalid] = useState<FieldId[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const values: Partial<Record<FieldId, number>> = {}
    const bad: FieldId[] = []
    for (const field of fields) {
      const raw = text[field.id]
      if (field.optional && raw.trim() === '') {
        values[field.id] = 0
        continue
      }
      const amount = parseAmount(raw)
      if (amount === null || (!field.allowNegative && amount < 0)) {
        bad.push(field.id)
      } else {
        values[field.id] = amount
      }
    }
    setInvalid(bad)
    if (bad.length > 0) {
      setError('Kontrollera de markerade fälten. Skriv belopp i hela kronor.')
      return
    }
    setBusy(true)
    try {
      await onSave({
        expenses: values.expenses ?? 0,
        savings: values.savings ?? 0,
        investments: values.investments ?? 0,
        deposited: values.deposited ?? 0,
        note: note.trim(),
      })
      navigate('/ekonomi')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onRemove()
      navigate('/ekonomi')
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : 'Något gick fel.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="divide-y rounded-xl border bg-card">
        {fields.map((field) => {
          const isInvalid = invalid.includes(field.id)
          const before = previous?.[field.id]
          return (
            <div key={field.id} className="space-y-1.5 p-3">
              <Label htmlFor={`finance-${field.id}`}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={`finance-${field.id}`}
                  inputMode={field.allowNegative ? 'text' : 'numeric'}
                  autoComplete="off"
                  value={text[field.id]}
                  onChange={(event) =>
                    setText((current) => ({
                      ...current,
                      [field.id]: event.target.value,
                    }))
                  }
                  placeholder={field.optional ? 'Valfritt' : '0'}
                  aria-invalid={isInvalid || undefined}
                  aria-describedby={`finance-${field.id}-hint`}
                  className="h-11 pr-10 text-base tabular-nums lg:h-9"
                />
                <span
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                  aria-hidden
                >
                  kr
                </span>
              </div>
              <p
                id={`finance-${field.id}-hint`}
                className="text-xs text-muted-foreground"
              >
                {field.hint}
                {before !== undefined && (before !== 0 || !field.optional) && (
                  <>
                    {' '}
                    Förra månaden: <span className="tabular-nums">{formatKronor(before)}</span>.
                  </>
                )}
              </p>
            </div>
          )
        })}
        <div className="space-y-1.5 p-3">
          <Label htmlFor="finance-note">Anteckning</Label>
          <Input
            id="finance-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Valfritt, till exempel en stor engångsutgift"
            className="h-11 text-base lg:h-9"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-sm" role="alert">
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="h-11 flex-1 sm:flex-none lg:h-9" disabled={busy}>
          {existing ? 'Spara ändringar' : 'Spara månaden'}
        </Button>
        <Link
          to="/ekonomi"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-11 flex-1 sm:flex-none lg:h-9',
          )}
        >
          Avbryt
        </Link>
        {existing && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 text-destructive sm:ml-auto lg:h-9"
                  disabled={busy}
                />
              }
            >
              <Trash2 aria-hidden />
              Ta bort månaden
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort {formatMonth(month)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Siffrorna för månaden försvinner från graferna och går inte
                  att få tillbaka.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  )
}

// Typing in one month's figures. /ekonomi/manad opens the month that is due,
// and /ekonomi/manad/2026-10 opens that month, filled in if it's already saved.
export function MoneyMonthPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { months, loadError, retry, save, remove } = useFinanceMonths()
  const now = useNow()
  const month = isMonthKey(params.month)
    ? params.month
    : dueMonthKey(new Date(now))

  const existing = months?.find((item) => item.month === month)
  const previousKey = previousMonthKey(month)
  const previous = months
    ?.filter((item) => item.month <= previousKey)
    .at(-1)

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <Link
        to="/ekonomi"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Ekonomi
      </Link>

      <header className="space-y-3">
        <h1 className="text-lg font-semibold first-letter:uppercase">
          {formatMonth(month)}
        </h1>
        <div className="space-y-1.5">
          <Label htmlFor="finance-month">Månad</Label>
          <Input
            id="finance-month"
            type="month"
            value={month}
            onChange={(event) => {
              if (isMonthKey(event.target.value)) {
                navigate(`/ekonomi/manad/${event.target.value}`, {
                  replace: true,
                })
              }
            }}
            className="h-11 w-48 text-base lg:h-9"
          />
        </div>
        {existing && (
          <p className="text-sm text-muted-foreground">
            Den här månaden är redan ifylld. Du ändrar de sparade siffrorna.
          </p>
        )}
      </header>

      {loadError && !months && (
        <div className="rounded-xl border">
          <LoadError message={loadError} onRetry={retry} />
        </div>
      )}

      {!months && !loadError && <Loading>Hämtar ekonomin…</Loading>}

      {months && (
        <MonthForm
          key={`${month}-${existing?.id ?? 'new'}`}
          month={month}
          existing={existing}
          previous={previous}
          onSave={(values) => save(month, values, existing?.id)}
          onRemove={() => (existing ? remove(existing.id) : Promise.resolve())}
        />
      )}
    </section>
  )
}
