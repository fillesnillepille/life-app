import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Check, Loader2, Mic, Send, Square, Undo2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { AiKeyNotice } from '@/components/ai-key-notice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { findByTitle, parseCommand, type Command } from '@/lib/ai-router'
import { pb } from '@/lib/pocketbase'
import { parseDateKey } from '@/lib/schedule'
import { serviceErrorMessage, serviceRequest } from '@/lib/service'
import {
  speechErrorMessage,
  speechSupported,
  startListening,
  type Listening,
} from '@/lib/speech'
import { lists } from '@/lib/todo-lists'
import { useTodos, type TodoListId } from '@/lib/use-todos'

type ChatAction =
  | { type: 'add_todo'; list: TodoListId; title: string }
  | {
      type: 'add_schedule_entry'
      title: string
      date: string
      allDay: boolean
      start: string
      end: string
    }

type ActionState = {
  action: ChatAction
  status: 'open' | 'saving' | 'done' | 'failed'
}

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  actions?: ActionState[]
  undo?: () => Promise<unknown>
  undone?: boolean
}

const listName = (id: TodoListId) =>
  lists.find((list) => list.id === id)?.tab ?? id

function describeAction(action: ChatAction) {
  if (action.type === 'add_todo') {
    return `Lägg till i ${listName(action.list)}: ${action.title}`
  }
  const day = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parseDateKey(action.date))
  const time = action.allDay ? 'heldag' : `${action.start}–${action.end}`
  return `Schemalägg ${day}, ${time}: ${action.title}`
}

const examples = [
  'Lägg till bädda sängen',
  'Köp mjölk',
  'Hur sov jag den senaste veckan?',
  'Vad har jag på schemat nästa vecka?',
]

export function AiPage() {
  const { todos, loadError, add, toggle, remove } = useTodos()
  const location = useLocation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const nextId = useRef(1)
  const messagesRef = useRef<Message[]>([])
  const listeningRef = useRef<Listening | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current = messages
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => () => listeningRef.current?.cancel(), [])

  const push = useCallback((message: Omit<Message, 'id'>) => {
    const id = nextId.current++
    setMessages((current) => [...current, { ...message, id }])
    return id
  }, [])

  const update = useCallback((id: number, changes: Partial<Message>) => {
    setMessages((current) =>
      current.map((m) => (m.id === id ? { ...m, ...changes } : m)),
    )
  }, [])

  // Runs a plain command in the app. Typing it is the approval, so it is done
  // at once and can be undone.
  const runCommand = useCallback(
    async (command: Command) => {
      if (command.kind === 'add') {
        const created = await add(command.list, command.title)
        if (!created) {
          return push({
            role: 'assistant',
            text: 'Kunde inte lägga till. Försök igen.',
          })
        }
        return push({
          role: 'assistant',
          text: `Lade till ”${created.title}” i ${listName(command.list)}.`,
          undo: () => remove(created),
        })
      }

      if (!todos) {
        return push({
          role: 'assistant',
          text: 'Listorna är inte hämtade än. Försök igen strax.',
        })
      }
      const found = findByTitle(todos, command.query)
      if (found.length === 0) {
        return push({
          role: 'assistant',
          text: `Hittade inget öppet som matchar ”${command.query}”.`,
        })
      }
      if (found.length > 1) {
        return push({
          role: 'assistant',
          text: `Flera matchar ”${command.query}”: ${found
            .map((todo) => todo.title)
            .join(', ')}. Skriv hela namnet.`,
        })
      }
      const [todo] = found
      if (command.kind === 'check') {
        await toggle(todo)
        return push({
          role: 'assistant',
          text: `Bockade av ”${todo.title}”.`,
          undo: () => toggle({ ...todo, done: true }),
        })
      }
      await remove(todo)
      return push({
        role: 'assistant',
        text: `Tog bort ”${todo.title}”.`,
        undo: () => add(todo.list, todo.title),
      })
    },
    [add, push, remove, todos, toggle],
  )

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || busy) return
      setInput('')
      push({ role: 'user', text })
      setBusy(true)
      try {
        const command = parseCommand(text)
        if (command) {
          await runCommand(command)
          return
        }
        const history = [
          ...messagesRef.current.map((m) => ({ role: m.role, content: m.text })),
          { role: 'user' as const, content: text },
        ]
        // The model wants the conversation to start with the user.
        const start = history.findIndex((m) => m.role === 'user')
        const reply = await serviceRequest<{
          text: string
          actions: ChatAction[]
        }>('/chat', {
          method: 'POST',
          body: { messages: history.slice(start).slice(-20) },
        })
        push({
          role: 'assistant',
          text: reply.text,
          actions: reply.actions.map((action) => ({
            action,
            status: 'open' as const,
          })),
        })
      } catch (error) {
        push({ role: 'assistant', text: serviceErrorMessage(error) })
      } finally {
        setBusy(false)
      }
    },
    [busy, push, runCommand],
  )

  // Text spoken by holding the AI button arrives here once, as soon as the
  // lists have loaded so "bocka av" can find its item.
  const handledKey = useRef('')
  useEffect(() => {
    const ask = (location.state as { ask?: string } | null)?.ask
    if (!ask || handledKey.current === location.key) return
    if (!todos && !loadError) return
    handledKey.current = location.key
    navigate(location.pathname, { replace: true, state: null })
    const run = () => void send(ask)
    run()
  }, [location.key, location.pathname, location.state, loadError, navigate, send, todos])

  async function runAction(messageId: number, index: number) {
    const message = messagesRef.current.find((m) => m.id === messageId)
    const entry = message?.actions?.[index]
    if (!message?.actions || !entry || entry.status !== 'open') return
    const setStatus = (status: ActionState['status']) =>
      update(messageId, {
        actions: message.actions?.map((a, i) =>
          i === index ? { ...a, status } : a,
        ),
      })
    setStatus('saving')
    try {
      const { action } = entry
      if (action.type === 'add_todo') {
        const created = await add(action.list, action.title)
        setStatus(created ? 'done' : 'failed')
      } else {
        const user = pb.authStore.record?.id
        if (!user) throw new Error('Inte inloggad')
        await pb.collection('schedule_entries').create(
          {
            title: action.title,
            date: action.date,
            allDay: action.allDay,
            start: action.start,
            end: action.end,
            todo: '',
            done: false,
            user,
          },
          { requestKey: null },
        )
        setStatus('done')
      }
    } catch {
      setStatus('failed')
    }
  }

  async function undo(message: Message) {
    if (!message.undo || message.undone) return
    update(message.id, { undone: true })
    await message.undo()
  }

  function toggleMic() {
    if (listeningRef.current) {
      listeningRef.current.stop()
      return
    }
    setSpeechError(null)
    const session = startListening({
      onText: setInput,
      onEnd: (text, error) => {
        listeningRef.current = null
        setListening(false)
        if (error) setSpeechError(speechErrorMessage(error))
        else if (text) setInput(text)
      },
    })
    if (!session) {
      setSpeechError('Taligenkänning stöds inte i den här webbläsaren.')
      return
    }
    listeningRef.current = session
    setListening(true)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Bot className="size-5" aria-hidden />
        AI
      </h1>

      <AiKeyNotice />

      <div className="flex min-h-[40svh] flex-col gap-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Skriv eller säg vad du vill. Enkla saker som att lägga till i en
              lista görs direkt, och resten besvaras av AI:n.
            </p>
            <ul className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => setInput(example)}
                    className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground'
                : 'mr-auto max-w-[85%] space-y-2 rounded-2xl border px-3 py-2 text-sm'
            }
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
            {message.undo && (
              <Button
                variant="ghost"
                size="xs"
                disabled={message.undone}
                onClick={() => void undo(message)}
              >
                <Undo2 aria-hidden />
                {message.undone ? 'Ångrad' : 'Ångra'}
              </Button>
            )}
            {message.actions?.map((entry, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-auto w-full justify-start whitespace-normal py-1.5 text-left"
                disabled={entry.status !== 'open'}
                onClick={() => void runAction(message.id, index)}
              >
                {entry.status === 'saving' && (
                  <Loader2 className="animate-spin" aria-hidden />
                )}
                {entry.status === 'done' && <Check aria-hidden />}
                {entry.status === 'failed'
                  ? `Misslyckades: ${describeAction(entry.action)}`
                  : describeAction(entry.action)}
              </Button>
            ))}
          </div>
        ))}

        {busy && (
          <p
            className="mr-auto flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Tänker…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {speechError && (
        <p className="text-xs text-destructive" role="alert">
          {speechError}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(input)
        }}
        className="sticky bottom-20 flex gap-2 bg-background py-2 lg:bottom-0"
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={listening ? 'Lyssnar…' : 'Skriv eller tala'}
          aria-label="Meddelande till AI"
          enterKeyHint="send"
          autoComplete="off"
          maxLength={1000}
          className="h-10"
        />
        {speechSupported() && (
          <Button
            type="button"
            variant={listening ? 'default' : 'outline'}
            size="icon-lg"
            className="size-10"
            aria-label={listening ? 'Sluta lyssna' : 'Tala'}
            aria-pressed={listening}
            onClick={toggleMic}
          >
            {listening ? <Square aria-hidden /> : <Mic aria-hidden />}
          </Button>
        )}
        <Button
          type="submit"
          size="icon-lg"
          className="size-10"
          aria-label="Skicka"
          disabled={busy || !input.trim()}
        >
          <Send aria-hidden />
        </Button>
      </form>
    </div>
  )
}
