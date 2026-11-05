import { useEffect, useState } from 'react'
import { pb, pocketbaseUrl } from './lib/pocketbase'
import './App.css'

type Connection = 'checking' | 'connected' | 'unreachable'

const statusText: Record<Connection, string> = {
  checking: 'Checking PocketBase…',
  connected: 'Connected to PocketBase',
  unreachable: 'Can’t reach PocketBase',
}

function App() {
  const [connection, setConnection] = useState<Connection>('checking')

  useEffect(() => {
    pb.health
      .check({ requestKey: null })
      .then(() => setConnection('connected'))
      .catch(() => setConnection('unreachable'))
  }, [])

  return (
    <main className="app">
      <h1>Life app</h1>
      <p className={`status status-${connection}`} role="status">
        {statusText[connection]}
      </p>
      <p className="address">{pocketbaseUrl}</p>
    </main>
  )
}

export default App
