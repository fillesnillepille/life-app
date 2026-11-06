import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatLongDay,
  offLabels,
  shiftOn,
  shiftLabel,
  timeRange,
  type OverrideKind,
  type ScheduleData,
  type ShiftColor,
  shiftStyle,
} from '@/lib/schedule'
import { cn } from '@/lib/utils'

// The choice is "cycle" (no change), "off", "vacation", "sick", or a shift
// type id.
const CYCLE = 'cycle'

export function OverrideDialog({
  date,
  data,
  onClose,
  onSave,
}: {
  // The dialog is open while this is set.
  date: string | null
  data: ScheduleData
  onClose: () => void
  onSave: (date: string, kind: OverrideKind | null, shiftType: string) => Promise<void>
}) {
  const [shown, setShown] = useState(date)
  if (date && date !== shown) setShown(date)

  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        {shown && (
          <OverrideForm
            key={shown}
            date={shown}
            data={data}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OverrideForm({
  date,
  data,
  onClose,
  onSave,
}: {
  date: string
  data: ScheduleData
  onClose: () => void
  onSave: (date: string, kind: OverrideKind | null, shiftType: string) => Promise<void>
}) {
  const override = data.overrides.find((item) => item.date === date)
  const fromCycle = shiftOn(date, { ...data, overrides: [] })
  const [choice, setChoice] = useState(
    !override ? CYCLE : override.kind === 'shift' ? override.shiftType : override.kind,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const options: { value: string; label: string; detail?: string; color?: ShiftColor }[] = [
    {
      value: CYCLE,
      label: 'Enligt schemat',
      detail:
        fromCycle.kind === 'shift'
          ? `${fromCycle.type.name} ${timeRange(fromCycle.type.start, fromCycle.type.end)}`
          : shiftLabel(fromCycle) || 'Inget schema inlagt',
    },
    ...data.types.map((type) => ({
      value: type.id,
      label: type.name,
      detail: timeRange(type.start, type.end),
      color: type.color,
    })),
    ...(Object.keys(offLabels) as (keyof typeof offLabels)[]).map((kind) => ({
      value: kind,
      label: offLabels[kind],
    })),
  ]

  const save = async () => {
    setBusy(true)
    try {
      if (choice === CYCLE) await onSave(date, null, '')
      else if (choice in offLabels) await onSave(date, choice as OverrideKind, '')
      else await onSave(date, 'shift', choice)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Ändra dagen</DialogTitle>
        <DialogDescription>
          {formatLongDay(date)}. Gäller bara den här dagen, sedan fortsätter
          schemat som vanligt.
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Skift" className="grid gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
            )}
          >
            <input
              type="radio"
              name="override"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                'size-3 shrink-0 rounded-sm border',
                !option.color && 'border-dashed',
              )}
              style={option.color ? shiftStyle(option.color) : undefined}
              aria-hidden
            />
            <span className="flex-1 font-medium">{option.label}</span>
            {option.detail && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {option.detail}
              </span>
            )}
          </label>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" className="h-11 lg:h-8" onClick={onClose}>
          Avbryt
        </Button>
        <Button className="h-11 lg:h-8" disabled={busy} onClick={save}>
          Spara
        </Button>
      </DialogFooter>
    </div>
  )
}
