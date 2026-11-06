import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { Loading } from '@/components/load-status'
import { refreshSession, useIsSignedIn } from '@/lib/auth'
import { allSections } from '@/lib/sections'
import { getStartPage, startPagePaths } from '@/lib/start-page'
import { AiPage } from '@/pages/ai-page'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { MailPage } from '@/pages/mail-page'
import { MorePage } from '@/pages/more-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { SchedulePage } from '@/pages/schedule-page'
import { ShiftCyclePage } from '@/pages/shift-cycle-page'
import { TasksPage } from '@/pages/tasks-page'
import { TodayPage } from '@/pages/today-page'

// Reading a message needs the HTML cleaner, which is a large library, so that
// page is only downloaded when a message is opened.
const MailMessagePage = lazy(() =>
  import('@/pages/mail-message-page').then((module) => ({
    default: module.MailMessagePage,
  })),
)

// The Ekonomi pages need the chart library, which is large, so they are only
// downloaded when opened.
const MoneyPage = lazy(() =>
  import('@/pages/money-page').then((module) => ({ default: module.MoneyPage })),
)
const MoneyMonthPage = lazy(() =>
  import('@/pages/money-month-page').then((module) => ({
    default: module.MoneyMonthPage,
  })),
)

// Hälsa's day-grade charts need the chart library too.
const HealthPage = lazy(() =>
  import('@/pages/health-page').then((module) => ({ default: module.HealthPage })),
)

const moneyFallback = <Loading>Hämtar ekonomin…</Loading>

// Sections with a real page. The rest show a placeholder until they're built.
const pages: Record<string, React.ReactNode> = {
  today: <TodayPage />,
  schedule: <SchedulePage />,
  home: <HomePage />,
  tasks: <TasksPage />,
  health: (
    <Suspense fallback={<Loading>Hämtar hälsan…</Loading>}>
      <HealthPage />
    </Suspense>
  ),
  money: (
    <Suspense fallback={moneyFallback}>
      <MoneyPage />
    </Suspense>
  ),
  mail: <MailPage />,
}

function SignedInApp() {
  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={startPagePaths[getStartPage()]} replace />}
        />
        {allSections.map((item) => (
          <Route
            key={item.id}
            path={item.path}
            element={pages[item.id] ?? <PlaceholderPage title={item.label} />}
          />
        ))}
        <Route
          path="/mejl/:uidValidity/:uid"
          element={
            <Suspense fallback={<Loading>Hämtar mejlet…</Loading>}>
              <MailMessagePage />
            </Suspense>
          }
        />
        {['/ekonomi/manad', '/ekonomi/manad/:month'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <Suspense fallback={moneyFallback}>
                <MoneyMonthPage />
              </Suspense>
            }
          />
        ))}
        <Route path="/schema/skift" element={<ShiftCyclePage />} />
        <Route path="/mer" element={<MorePage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const isSignedIn = useIsSignedIn()

  useEffect(() => {
    void refreshSession()
  }, [])

  // Signing in keeps the address, so a link to /hem lands on Hem after login.
  return isSignedIn ? <SignedInApp /> : <LoginPage />
}

export default App
