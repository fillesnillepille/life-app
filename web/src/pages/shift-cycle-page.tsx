import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { LoadError, Loading } from '@/components/load-status'
import { Panel } from '@/components/panel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TimeField } from '@/components/time-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CYCLE_DAYS,
  CYCLE_WEEKS,
  crossesMidnight,
  cycleWeek,
  formatLongDay,
  isDateKey,
  isTime,
  mondayOf,
  shiftColors,
  timeRange,
  todayKey,
  weekdayIndex,
  type ShiftColor,
  type ShiftCycle,
  type ShiftType,
  shiftStyle,
} from '@/lib/schedule'
import { useSchedule } from '@/lib/use-schedule'
import { cn } from '@/lib/utils'

const weekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
const weekdayNames = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

export function ShiftCyclePage() {
  const schedule = useSchedule()
  const { data } = schedule

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <Link
          to="/schema"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Schema
        </Link>
        <h1 className="text-lg font-semibold">Skift och schema</h1>
        <p className="text-sm text-muted-foreground">
          Lägg in dina skifttyper och vilket skift du har varje dag i
          {` ${CYCLE_WEEKS}`}-veckorscykeln. Den upprepas sedan av sig själv.
        </p>
      </header>

      {!data &&
        (schedule.loadError ? (
          <div className="rounded-xl border">
            <LoadError message={schedule.loadError} onRetry={schedule.retry} />
          </div>
        ) : (
          <Loading>Hämtar schemat…</Loading>
        ))}

      {data && (
        <div className="grid items-start gap-4 lg:grid-cols-[20rem_1fr]">
          <ShiftTypes
            types={data.types}
            onSave={schedule.saveType}
            onRemove={(type) => schedule.removeType(type, data.cycle)}
          />
          <CycleEditor
            key={data.cycle?.id ?? 'new'}
            cycle={data.cycle}
            types={data.types}
            onSave={schedule.saveCycle}
          />
        </div>
      )}
    </section>
  )
}

function ShiftTypes({
  types,
  onSave,
  onRemove,
}: {
  types: ShiftType[]
  onSave: (values: Omit<ShiftType, 'id'>, existingId?: string) => Promise<void>
  onRemove: (type: ShiftType) => Promise<void>
}) {
  // null: closed. "new": adding. Otherwise the type being changed.
  const [editing, setEditing] = useState<ShiftType | 'new' | null>(null)
  const [shownEditing, setShownEditing] = useState(editing)
  if (editing && editing !== shownEditing) setShownEditing(editing)
  const [removing, setRemoving] = useState<ShiftType | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setConfirmOpen(false)
    if (!removing) return
    try {
      await onRemove(removing)
      setError(null)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Något gick fel.')
    }
  }

  return (
    <Panel title="Skifttyper" meta={`${types.length} st`}>
      {types.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">
          Inga skift än. Lägg till till exempel Dag, Kväll och Natt.
        </p>
      )}
      <ul className="divide-y">
        {types.map((type) => (
          <li key={type.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
            <span
              className="size-3 shrink-0 rounded-sm border"
              style={shiftStyle(type.color)}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-medium">{type.name}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {timeRange(type.start, type.end)}
                {crossesMidnight(type.start, type.end) && ', över midnatt'}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-muted-foreground lg:size-8"
              aria-label={`Ändra ${type.name}`}
              onClick={() => setEditing(type)}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-muted-foreground lg:size-8"
              aria-label={`Ta bort ${type.name}`}
              onClick={() => {
                setRemoving(type)
                setConfirmOpen(true)
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="border-t p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="border-t p-3">
        <Button
          variant="outline"
          className="h-11 w-full lg:h-8"
          onClick={() => setEditing('new')}
        >
          <Plus aria-hidden />
          Nytt skift
        </Button>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent showCloseButton={false}>
          {shownEditing && (
            <ShiftTypeForm
              key={shownEditing === 'new' ? 'new' : shownEditing.id}
              existing={shownEditing === 'new' ? undefined : shownEditing}
              onClose={() => setEditing(null)}
              onSave={onSave}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort skiftet?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              ”{removing?.name}” tas bort. Dagar med det skiftet i schemat blir
              lediga, och ändrade dagar som använder det går tillbaka till schemat.
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
    </Panel>
  )
}

function ShiftTypeForm({
  existing,
  onClose,
  onSave,
}: {
  existing?: ShiftType
  onClose: () => void
  onSave: (values: Omit<ShiftType, 'id'>, existingId?: string) => Promise<void>
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [start, setStart] = useState(existing?.start ?? '07:00')
  const [end, setEnd] = useState(existing?.end ?? '16:00')
  const [color, setColor] = useState<ShiftColor>(existing?.color ?? 'blue')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Ge skiftet ett namn.')
    if (!isTime(start) || !isTime(end)) return setError('Fyll i start- och sluttid.')
    if (start === end) return setError('Sluttiden måste skilja sig från starttiden.')
    setBusy(true)
    try {
      await onSave({ name: name.trim(), start, end, color }, existing?.id)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Ändra skift' : 'Nytt skift'}</DialogTitle>
        <DialogDescription>
          Slutar skiftet före starttiden räknas det som att det går över midnatt.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="shift-name">Namn</Label>
        <Input
          id="shift-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="Dag, Kväll, Natt"
          className="h-11 text-base lg:h-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="shift-start">Start</Label>
          <TimeField
            id="shift-start"
            value={start}
            onChange={setStart}
            className="h-11 text-base lg:h-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shift-end">Slut</Label>
          <TimeField
            id="shift-end"
            value={end}
            onChange={setEnd}
            className="h-11 text-base lg:h-9"
          />
        </div>
        {isTime(start) && isTime(end) && start !== end && crossesMidnight(start, end) && (
          <p className="col-span-2 text-xs text-muted-foreground">
            Går över midnatt och slutar dagen efter.
          </p>
        )}
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Färg</legend>
        <div className="flex flex-wrap gap-2">
          {shiftColors.map((option) => (
            <label
              key={option.id}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 lg:h-9"
            >
              <input
                type="radio"
                name="shift-color"
                value={option.id}
                checked={color === option.id}
                onChange={() => setColor(option.id)}
                className="sr-only"
              />
              <span
                className="size-3 rounded-sm border"
                style={shiftStyle(option.id)}
                aria-hidden
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 lg:h-8" onClick={onClose}>
          Avbryt
        </Button>
        <Button type="submit" className="h-11 lg:h-8" disabled={busy}>
          Spara
        </Button>
      </DialogFooter>
    </form>
  )
}

// An empty string is a day off.
const OFF = ''

function CycleEditor({
  cycle,
  types,
  onSave,
}: {
  cycle: ShiftCycle | null
  types: ShiftType[]
  onSave: (startDate: string, days: string[], existingId?: string) => Promise<void>
}) {
  const today = todayKey()
  const [startDate, setStartDate] = useState(cycle?.startDate ?? mondayOf(today))
  const [days, setDays] = useState<string[]>(
    () => cycle?.days ?? Array.from({ length: CYCLE_DAYS }, () => OFF),
  )
  // The shift that tapping a day sets.
  const [brush, setBrush] = useState<string>(types[0]?.id ?? OFF)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const typeById = (id: string) => types.find((type) => type.id === id)
  const brushName = typeById(brush)?.name ?? 'Ledig'
  const dirty =
    !cycle ||
    startDate !== cycle.startDate ||
    days.some((id, index) => id !== cycle.days[index])
  const validStart = isDateKey(startDate) && weekdayIndex(startDate) === 0
  const currentWeek = validStart
    ? cycleWeek({ id: '', startDate, days }, today)
    : null

  const paint = (index: number) => {
    setSaved(false)
    setDays((current) => current.map((id, at) => (at === index ? brush : id)))
  }

  const save = async () => {
    if (!validStart) return setError('Vecka 1 måste börja på en måndag.')
    setBusy(true)
    setError(null)
    try {
      await onSave(startDate, days, cycle?.id)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Något gick fel.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={`${CYCLE_WEEKS}-veckorsschema`} meta={currentWeek ? `Nu: vecka ${currentWeek}` : undefined}>
      <div className="space-y-4 p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cycle-start">Vecka 1 börjar måndagen</Label>
          <Input
            id="cycle-start"
            type="date"
            value={startDate}
            onChange={(event) => {
              setSaved(false)
              setStartDate(event.target.value)
            }}
            aria-invalid={!validStart || undefined}
            aria-describedby="cycle-start-hint"
            className="h-11 w-fit text-base lg:h-9"
          />
          <p id="cycle-start-hint" className="text-xs text-muted-foreground">
            {validStart
              ? `Välj en måndag då en vecka 1 började, gärna nyligen. Idag, ${formatLongDay(today).toLowerCase()}, är vecka ${currentWeek}.`
              : 'Välj en måndag.'}
          </p>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">
            Välj ett skift och tryck på dagarna
          </legend>
          <div className="flex flex-wrap gap-2">
            {[...types.map((type) => ({ id: type.id, name: type.name, color: type.color as ShiftColor | undefined })), { id: OFF, name: 'Ledig', color: undefined }].map((option) => (
              <label
                key={option.id || 'off'}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 lg:h-9"
              >
                <input
                  type="radio"
                  name="cycle-brush"
                  value={option.id}
                  checked={brush === option.id}
                  onChange={() => setBrush(option.id)}
                  className="sr-only"
                />
                <span
                  className={cn('size-3 rounded-sm border', !option.color && 'border-dashed')}
                  style={option.color ? shiftStyle(option.color) : undefined}
                  aria-hidden
                />
                {option.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="w-8" />
                {weekdays.map((day) => (
                  <th key={day} scope="col" className="font-medium text-muted-foreground">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: CYCLE_WEEKS }, (_, week) => (
                <tr key={week}>
                  <th
                    scope="row"
                    className={cn(
                      'font-medium text-muted-foreground',
                      currentWeek === week + 1 && 'text-foreground',
                    )}
                  >
                    V{week + 1}
                  </th>
                  {weekdays.map((_, weekday) => {
                    const index = week * 7 + weekday
                    const type = typeById(days[index])
                    return (
                      <td key={weekday} className="p-0">
                        <button
                          type="button"
                          onClick={() => paint(index)}
                          className={cn(
                            'flex h-11 w-full items-center justify-center overflow-hidden rounded-md border px-0.5 hover:bg-accent/60',
                            !type && 'border-dashed text-muted-foreground',
                            type && 'border-l-[3px]',
                          )}
                          style={type ? shiftStyle(type.color) : undefined}
                          aria-label={`Vecka ${week + 1} ${weekdayNames[weekday]}: ${type?.name ?? 'Ledig'}. Sätt till ${brushName}`}
                        >
                          <span className="truncate sm:hidden">
                            {type ? type.name.slice(0, 2) : '–'}
                          </span>
                          <span className="hidden truncate sm:inline">
                            {type?.name ?? 'Ledig'}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {saved && !dirty && (
            <p className="mr-auto text-sm text-muted-foreground" role="status">
              Schemat är sparat.
            </p>
          )}
          {cycle && dirty && (
            <Button
              variant="outline"
              className="h-11 lg:h-8"
              onClick={() => {
                setStartDate(cycle.startDate)
                setDays(cycle.days)
              }}
            >
              Ångra ändringar
            </Button>
          )}
          <Button className="h-11 lg:h-8" disabled={busy || !dirty} onClick={save}>
            Spara schemat
          </Button>
        </div>
      </div>
    </Panel>
  )
}
