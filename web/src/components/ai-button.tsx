import { useEffect, useRef, useState } from 'react'
import { Bot, Mic } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { speechSupported, startListening, type Listening } from '@/lib/speech'
import { cn } from '@/lib/utils'

// How long to press before it starts listening. A shorter press just opens
// the chat.
const HOLD_MS = 450

// The AI button. A tap opens /ai. Holding it records speech, and letting go
// sends what was said to the chat.
export function AiButton({ variant }: { variant: 'side' | 'tab' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [recording, setRecording] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const session = useRef<Listening | null>(null)
  const held = useRef(false)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      session.current?.cancel()
    },
    [],
  )

  function begin(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !speechSupported()) return
    event.currentTarget.setPointerCapture(event.pointerId)
    held.current = false
    timer.current = window.setTimeout(() => {
      session.current = startListening({
        onEnd: (text) => {
          session.current = null
          setRecording(false)
          navigate('/ai', { state: text ? { ask: text } : null })
        },
      })
      held.current = session.current !== null
      setRecording(held.current)
    }, HOLD_MS)
  }

  function finish() {
    window.clearTimeout(timer.current)
    if (session.current) {
      // The result arrives in onEnd.
      session.current.stop()
    } else if (!held.current) {
      navigate('/ai')
    }
    held.current = false
  }

  const active = pathname === '/ai'
  const Icon = recording ? Mic : Bot
  const label = recording ? 'Lyssnar, släpp för att skicka' : 'AI'

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={begin}
      onPointerUp={finish}
      onPointerCancel={() => {
        window.clearTimeout(timer.current)
        session.current?.cancel()
        session.current = null
        held.current = false
        setRecording(false)
      }}
      onContextMenu={(event) => event.preventDefault()}
      // Keyboard use has no pointer events, so Enter and Space come as a click
      // with no click count.
      onClick={(event) => {
        if (event.detail === 0) navigate('/ai')
      }}
      className={cn(
        'touch-none select-none',
        variant === 'side'
          ? cn(
              'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
              active && 'border-primary bg-sidebar-accent text-foreground',
              recording && 'text-primary',
            )
          : cn(
              '-mt-3 grid w-24 shrink-0 place-items-center rounded-tl-2xl border-t-2 border-l-2 border-primary bg-sidebar pt-2.5 text-primary transition-colors active:bg-primary/10 motion-reduce:transition-none',
              (active || recording) && 'bg-primary/10',
            ),
      )}
    >
      <Icon
        className={cn(
          variant === 'side' ? 'size-4' : 'size-12',
          recording && 'animate-pulse motion-reduce:animate-none',
        )}
        strokeWidth={variant === 'tab' ? 1.75 : undefined}
        aria-hidden
      />
      {variant === 'side' && (recording ? 'Lyssnar…' : 'AI')}
    </button>
  )
}
