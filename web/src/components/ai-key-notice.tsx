import { KeyRound } from 'lucide-react'
import { addDays, formatShortDay, todayKey } from '@/lib/schedule'
import { aiKeyProblem, useAiStatus } from '@/lib/use-ai-status'
import { useNow } from '@/lib/use-now'

// A reminder to make a new Anthropic key before the old one runs out. Shows
// nothing when the key is fine, or when no expiry date was given.
export function AiKeyNotice() {
  const status = useAiStatus()
  const today = todayKey(useNow())
  const problem = aiKeyProblem(status, today, addDays)
  if (!problem || !status?.keyExpires) return null

  // "sön 15 nov", without the abbreviation's dot before the sentence's.
  const expires = formatShortDay(status.keyExpires).replace(/\.$/, '')
  const message =
    problem === 'expiring'
      ? `AI-nyckeln går ut ${expires}. Skapa en ny på console.anthropic.com och lägg in den i tjänsten innan dess.`
      : 'AI-nyckeln har gått ut. Skapa en ny på console.anthropic.com och lägg in den i tjänsten.'

  return (
    <section
      className="flex items-start gap-2 rounded-xl border border-primary/60 bg-card p-3 text-sm"
      role={problem === 'expiring' ? 'status' : 'alert'}
    >
      <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </section>
  )
}
