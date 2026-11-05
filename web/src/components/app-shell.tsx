import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router'
import { signOut } from '@/lib/auth'
import {
  allSections,
  bottomBarSections,
  moreSectionIds,
  sectionIdFromPath,
} from '@/lib/sections'
import { cn } from '@/lib/utils'
import {
  usePocketBaseStatus,
  type PocketBaseStatus,
} from '@/lib/use-pocketbase-status'

export function AppShell({ children }: { children: ReactNode }) {
  const { status, retry } = usePocketBaseStatus()
  const { pathname } = useLocation()
  const section = sectionIdFromPath(pathname)

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[13rem_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-sidebar lg:flex">
        <p className="border-b px-4 py-4 text-sm font-semibold tracking-widest">
          Filip
        </p>
        <nav aria-label="Sektioner" className="flex-1 p-2">
          {allSections.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                  isActive && 'border-primary bg-sidebar-accent text-foreground',
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t p-4">
          <ConnectionStatus status={status} onRetry={retry} />
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden />
            Logga ut
          </button>
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <p className="text-sm font-semibold tracking-widest">Filip</p>
          <ConnectionStatus status={status} onRetry={retry} />
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
      </div>

      <nav
        aria-label="Sektioner"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {bottomBarSections.map((item) => {
          // "Mer" also counts as active on the sections it leads to.
          const active =
            item.id === 'more'
              ? section !== undefined && moreSectionIds.includes(section)
              : section === item.id
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[11px] text-muted-foreground',
                active && 'border-primary text-primary',
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function ConnectionStatus({
  status,
  onRetry,
}: {
  status: PocketBaseStatus
  onRetry: () => void
}) {
  if (status === 'unreachable') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 text-xs text-destructive underline-offset-4 hover:underline"
      >
        <span className="size-2 bg-destructive" aria-hidden />
        DB offline, försök igen
      </button>
    )
  }

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <span
        className={cn(
          'size-2 bg-emerald-400',
          status === 'checking' && 'animate-pulse bg-muted-foreground',
        )}
        aria-hidden
      />
      {status === 'checking' ? 'DB kontrolleras' : 'DB online'}
    </p>
  )
}
