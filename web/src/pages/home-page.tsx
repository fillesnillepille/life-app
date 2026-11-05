import { useState } from 'react'
import { LightsPanel } from '@/components/lights-panel'
import { Panel } from '@/components/panel'
import { Switch } from '@/components/ui/switch'
import { getStartPage, setStartPage } from '@/lib/start-page'

export function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hem</h1>
      <div className="max-w-2xl space-y-4">
        <LightsPanel showBrightness />
        <StartPageSetting />
      </div>
    </div>
  )
}

// For a touch screen on the wall: open the app straight on Hem. It is a
// per-device choice, so a phone can keep starting on Idag.
function StartPageSetting() {
  const [isHome, setIsHome] = useState(() => getStartPage() === 'home')

  return (
    <Panel title="Den här enheten">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">
          Starta på Hem
          <span className="block text-xs text-muted-foreground">
            Appen öppnas på Hem på den här enheten. Andra enheter påverkas inte.
          </span>
        </span>
        <Switch
          checked={isHome}
          onCheckedChange={(checked) => {
            setIsHome(checked)
            setStartPage(checked ? 'home' : 'today')
          }}
        />
      </label>
    </Panel>
  )
}
