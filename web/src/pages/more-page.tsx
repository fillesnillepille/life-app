import { ChevronRight, LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { signOut } from '@/lib/auth'
import { moreSections } from '@/lib/sections'

export function MorePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Mer</h1>
      <div className="divide-y overflow-hidden rounded-xl border">
        {moreSections.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm hover:bg-accent"
          >
            <item.icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm hover:bg-accent lg:hidden"
      >
        <LogOut className="size-4 text-muted-foreground" aria-hidden />
        Logga ut
      </button>
    </section>
  )
}
