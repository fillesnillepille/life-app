import { createElement, type CSSProperties } from 'react'
import { sportIcon } from '@/lib/garmin'

// The Lucide icon for a Garmin sport, in the training colour.
export function SportIcon({
  type,
  className,
  style,
}: {
  type: string
  className?: string
  style?: CSSProperties
}) {
  return createElement(sportIcon(type), {
    className,
    style: { color: 'var(--activity)', ...style },
    'aria-hidden': true,
  })
}
