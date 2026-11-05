import { useState } from 'react'
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import { Panel } from '@/components/panel'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useLights, type Light } from '@/lib/use-lights'

export function LightsPanel({ showBrightness = false }: { showBrightness?: boolean }) {
  const {
    lights,
    scenes,
    loadError,
    actionError,
    retry,
    setLight,
    activateScene,
  } = useLights()

  const lightsOn = lights?.filter((light) => light.on).length ?? 0
  const meta = lights
    ? `${lightsOn} ${lightsOn === 1 ? 'tänd' : 'tända'}`
    : undefined

  return (
    <Panel title="Belysning" meta={meta}>
      {loadError && (
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <p className="flex items-start gap-2 text-sm" role="alert">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            {loadError}
          </p>
          <Button
            variant="outline"
            className="h-11 shrink-0 lg:h-8"
            onClick={() => void retry()}
          >
            <RefreshCw aria-hidden />
            Försök igen
          </Button>
        </div>
      )}

      {!lights && !loadError && (
        <p
          className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Hämtar lampor…
        </p>
      )}

      {lights?.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">
          Inga lampor hittades i Home Assistant.
        </p>
      )}

      {lights && lights.length > 0 && (
        <ul className="divide-y">
          {lights.map((light) => (
            <LightRow
              key={light.id}
              light={light}
              showBrightness={showBrightness}
              onChange={setLight}
            />
          ))}
        </ul>
      )}

      {actionError && (
        <p className="border-t p-3 text-sm text-destructive" role="alert">
          Kunde inte ändra belysningen. {actionError}
        </p>
      )}

      {scenes.length > 0 && (
        <div className="grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-3">
          {scenes.map((scene) => (
            <Button
              key={scene.id}
              variant="outline"
              className="h-11 min-w-0 px-2 lg:h-8"
              onClick={() => void activateScene(scene.id)}
            >
              <span className="truncate">{scene.name}</span>
            </Button>
          ))}
        </div>
      )}
    </Panel>
  )
}

function LightRow({
  light,
  showBrightness,
  onChange,
}: {
  light: Light
  showBrightness: boolean
  onChange: (id: string, on: boolean, brightness?: number) => Promise<void>
}) {
  const [dragging, setDragging] = useState<number | null>(null)
  const brightness = dragging ?? light.brightness ?? 100
  const canDim = showBrightness && light.supportsBrightness && light.on

  return (
    <li className={light.available ? undefined : 'opacity-60'}>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm">
        <span className="min-w-0">
          <span className="block truncate">{light.name}</span>
          {!light.available && (
            <span className="block text-xs text-muted-foreground">
              Inte tillgänglig
            </span>
          )}
        </span>
        <Switch
          checked={light.on}
          disabled={!light.available}
          onCheckedChange={(on) => void onChange(light.id, on)}
        />
      </label>
      {canDim && light.available && (
        <div className="flex min-h-11 items-center gap-3 px-3 pb-2">
          <Slider
            aria-label={`Ljusstyrka för ${light.name}`}
            min={1}
            max={100}
            value={[brightness]}
            onValueChange={(value) =>
              setDragging(Array.isArray(value) ? value[0] : (value as number))
            }
            onValueCommitted={(value) => {
              const next = Array.isArray(value) ? value[0] : (value as number)
              void onChange(light.id, true, next).finally(() =>
                setDragging(null),
              )
            }}
          />
          <span className="w-12 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {brightness} %
          </span>
        </div>
      )}
    </li>
  )
}
