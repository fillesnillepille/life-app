import type { ReactNode } from 'react'

// One figure in a row of figures at the top of a Hälsa section.
export function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail: string
}) {
  return (
    <div className="min-w-0 p-3">
      <dt className="truncate text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2 truncate text-lg font-semibold tabular-nums sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</dd>
    </div>
  )
}
