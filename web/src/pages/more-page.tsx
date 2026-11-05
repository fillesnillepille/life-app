import { ChevronRight, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { allSections, type SectionId } from '@/lib/sections'

export function MorePage({
  onNavigate,
}: {
  onNavigate: (section: SectionId) => void
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Mer</h1>
      <div className="divide-y border">
        {allSections.slice(4).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm hover:bg-accent"
          >
            <item.icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex min-h-12 w-full items-center gap-3 border px-3 text-left text-sm hover:bg-accent lg:hidden"
      >
        <LogOut className="size-4 text-muted-foreground" aria-hidden />
        Logga ut
      </button>
    </section>
  )
}
