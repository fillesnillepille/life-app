import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { pb, pocketbaseUrl } from '@/lib/pocketbase'

type Connection = 'checking' | 'connected' | 'unreachable'

async function checkPocketBase(): Promise<Connection> {
  try {
    await pb.health.check({ requestKey: null })
    return 'connected'
  } catch {
    return 'unreachable'
  }
}

function App() {
  const [connection, setConnection] = useState<Connection>('checking')

  useEffect(() => {
    void checkPocketBase().then(setConnection)
  }, [])

  const retry = () => {
    setConnection('checking')
    void checkPocketBase().then(setConnection)
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Life app</CardTitle>
          <CardDescription className="font-mono break-all">
            {pocketbaseUrl}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium" role="status">
            {connection === 'checking' && (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Checking PocketBase…
              </>
            )}
            {connection === 'connected' && (
              <>
                <CircleCheck
                  className="size-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                Connected to PocketBase
              </>
            )}
            {connection === 'unreachable' && (
              <>
                <CircleAlert className="size-4 text-destructive" aria-hidden />
                Can’t reach PocketBase
              </>
            )}
          </p>
          {connection === 'unreachable' && (
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw aria-hidden />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default App
