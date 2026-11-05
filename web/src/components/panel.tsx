import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Panel({
  title,
  meta,
  accent,
  children,
}: {
  title: string
  meta?: string
  accent?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border bg-card',
        accent && 'border-primary/60',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <h2 className="text-xs font-semibold tracking-widest uppercase">
          {title}
        </h2>
        {meta && (
          <p className="text-xs text-muted-foreground tabular-nums">{meta}</p>
        )}
      </header>
      {children}
    </section>
  )
}
