import { useId, useState, type FormEvent } from 'react'
import { MoodIcon } from '@/components/mood-icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  averageOf,
  formatAverage,
  grades,
  moodOf,
  type DayRating,
  type GradeKey,
  type RatingValues,
} from '@/lib/day-rating'
import { cn } from '@/lib/utils'

type Values = Record<GradeKey, number>

const empty: Values = {
  work: 0,
  exercise: 0,
  food: 0,
  social: 0,
  creativity: 0,
  general: 0,
}

// The grades for one day: 1-5 in each area, with Arbete on work days, and an
// optional comment. Every grade that applies must be set before saving.
export function RatingForm({
  workDay,
  dayWord,
  existing,
  onSave,
  onCancel,
  footer = 'inline',
}: {
  // The schedule has a shift that day, so Arbete is graded.
  workDay: boolean
  // "idag" or "igår", for the "Jobbade ..." switch.
  dayWord: string
  existing?: DayRating
  onSave: (values: RatingValues) => Promise<unknown>
  onCancel?: () => void
  // "dialog" puts the buttons in a dialog footer.
  footer?: 'inline' | 'dialog'
}) {
  const [values, setValues] = useState<Values>(() =>
    existing ? { ...empty, ...pick(existing) } : empty,
  )
  const [extraWork, setExtraWork] = useState(
    !workDay && (existing?.worked ?? false),
  )
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()

  const worked = workDay || extraWork
  const shown = grades.filter((grade) => grade.key !== 'work' || worked)
  const missing = shown.filter((grade) => !values[grade.key])
  const preview = { ...values, worked }
  const average = missing.length === 0 ? averageOf(preview) : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (missing.length > 0) {
      setError(
        `Sätt betyg på ${missing.map((grade) => grade.label.toLowerCase()).join(', ')}.`,
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({
        ...values,
        work: worked ? values.work : 0,
        worked,
        comment: comment.trim(),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
      setBusy(false)
    }
  }

  const buttons = (
    <>
      {onCancel && (
        <Button type="button" variant="outline" className="h-11 lg:h-8" onClick={onCancel}>
          Avbryt
        </Button>
      )}
      <Button type="submit" className="h-11 lg:h-8" disabled={busy}>
        Spara betyg
      </Button>
    </>
  )

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      {!workDay && (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Jobbade {dayWord}
          <Switch checked={extraWork} onCheckedChange={setExtraWork} />
        </label>
      )}

      <div className="divide-y rounded-lg border">
        {shown.map((grade) => (
          <fieldset
            key={grade.key}
            className="grid gap-2 p-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3"
          >
            <legend className="sr-only">
              {grade.label}: {grade.hint}
            </legend>
            <div className="min-w-0 sm:flex-1" aria-hidden>
              <p className="text-sm font-medium">{grade.label}</p>
              <p className="text-xs text-muted-foreground">{grade.hint}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex size-11 cursor-pointer items-center justify-center rounded-md border text-sm tabular-nums transition-colors hover:bg-accent lg:size-9',
                    'has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground',
                    'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-${grade.key}`}
                    value={value}
                    checked={values[grade.key] === value}
                    onChange={() =>
                      setValues((current) => ({ ...current, [grade.key]: value }))
                    }
                    className="sr-only"
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-comment`}>Kommentar</Label>
        <Textarea
          id={`${id}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          placeholder="Valfritt. Något som hände, eller varför dagen blev som den blev."
        />
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {average === null ? (
          `${missing.length} kvar att betygsätta`
        ) : (
          <>
            <MoodIcon rating={{ ...emptyRating, ...preview }} className="text-foreground" />
            {moodOf(average).label}, snitt {formatAverage(average)}
          </>
        )}
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {footer === 'dialog' ? (
        <DialogFooter>{buttons}</DialogFooter>
      ) : (
        <div className="flex justify-end gap-2">{buttons}</div>
      )}
    </form>
  )
}

const emptyRating: DayRating = {
  id: '',
  date: '',
  worked: false,
  comment: '',
  ...empty,
}

function pick(rating: DayRating): Values {
  return {
    work: rating.work,
    exercise: rating.exercise,
    food: rating.food,
    social: rating.social,
    creativity: rating.creativity,
    general: rating.general,
  }
}

// The grading form in a dialog, for Schema.
export function RatingDialog({
  target,
  onClose,
  onSave,
}: {
  // The dialog is open while this is set.
  target: {
    date: string
    title: string
    dayWord: string
    workDay: boolean
    existing?: DayRating
  } | null
  onClose: () => void
  onSave: (date: string, values: RatingValues, existingId?: string) => Promise<unknown>
}) {
  const [shown, setShown] = useState(target)
  if (target && target !== shown) setShown(target)

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
      >
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle>Hur var dagen?</DialogTitle>
              <DialogDescription>{shown.title}</DialogDescription>
            </DialogHeader>
            <RatingForm
              key={shown.date}
              workDay={shown.workDay}
              dayWord={shown.dayWord}
              existing={shown.existing}
              footer="dialog"
              onCancel={onClose}
              onSave={async (values) => {
                await onSave(shown.date, values, shown.existing?.id)
                onClose()
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
