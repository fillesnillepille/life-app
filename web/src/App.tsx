import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { refreshSession, useIsSignedIn } from '@/lib/auth'
import { allSections, type SectionId } from '@/lib/sections'
import { LoginPage } from '@/pages/login-page'
import { MorePage } from '@/pages/more-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { TodayPage } from '@/pages/today-page'

function SignedInApp() {
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

function App() {
  const isSignedIn = useIsSignedIn()

  useEffect(() => {
    void refreshSession()
  }, [])

  return isSignedIn ? <SignedInApp /> : <LoginPage />
}

export default App
