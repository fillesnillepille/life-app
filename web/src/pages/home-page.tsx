import { LightsPanel } from '@/components/lights-panel'

export function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hem</h1>
      <div className="max-w-2xl">
        <LightsPanel showBrightness />
      </div>
    </div>
  )
}
