import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { Loading } from '@/components/load-status'
import { refreshSession, useIsSignedIn } from '@/lib/auth'
import { allSections } from '@/lib/sections'
import { getStartPage, startPagePaths } from '@/lib/start-page'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { MailPage } from '@/pages/mail-page'
import { MorePage } from '@/pages/more-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { TasksPage } from '@/pages/tasks-page'
import { TodayPage } from '@/pages/today-page'

// Reading a message needs the HTML cleaner, which is a large library, so that
// page is only downloaded when a message is opened.
const MailMessagePage = lazy(() =>
  import('@/pages/mail-message-page').then((module) => ({
    default: module.MailMessagePage,
  })),
)

// Sections with a real page. The rest show a placeholder until they're built.
const pages: Record<string, React.ReactNode> = {
  today: <TodayPage />,
  home: <HomePage />,
  tasks: <TasksPage />,
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
        <Route path="/mer" element={<MorePage />} />
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
