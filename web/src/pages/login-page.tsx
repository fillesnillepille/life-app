import { useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ClientResponseError } from 'pocketbase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/lib/auth'

function errorMessage(error: unknown) {
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return 'Kan inte nå servern. Försök igen.'
    if (error.status === 429) return 'För många försök. Vänta en stund.'
    if (error.status === 400) return 'Fel e-post eller lösenord.'
  }
  return 'Något gick fel. Försök igen.'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(errorMessage(caught))
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-primary/60 bg-card"
      >
        <header className="border-b px-4 py-3">
          <p className="text-sm font-semibold tracking-widest">Filip</p>
        </header>
        <div className="space-y-4 p-4">
          <h1 className="text-xl font-semibold">Logga in</h1>
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              className="h-11"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting && (
              <LoaderCircle className="animate-spin" aria-hidden />
            )}
            {submitting ? 'Loggar in…' : 'Logga in'}
          </Button>
        </div>
      </form>
    </main>
  )
}
