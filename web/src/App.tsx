import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { allSections, type SectionId } from '@/lib/sections'
import { MorePage } from '@/pages/more-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { TodayPage } from '@/pages/today-page'

function App() {
  const [section, setSection] = useState<SectionId>('today')
  const current = allSections.find((item) => item.id === section)

  return (
    <AppShell section={section} onNavigate={setSection}>
      {section === 'today' && <TodayPage />}
      {section === 'more' && <MorePage onNavigate={setSection} />}
      {section !== 'today' && section !== 'more' && current && (
        <PlaceholderPage title={current.label} />
      )}
    </AppShell>
  )
}

export default App
