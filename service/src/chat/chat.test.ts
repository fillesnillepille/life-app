import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApp } from '../app.ts'
import { createHomeAssistant } from '../home-assistant.ts'
import { createChatService, type MessagesClient } from './chat.ts'
import { createUserData, shiftOn } from './data.ts'
import type { UserData } from './data.ts'

type Block = Awaited<ReturnType<MessagesClient['messages']['create']>>['content']

function fakeClient(replies: Block[]) {
  const requests: unknown[] = []
  let i = 0
  const client: MessagesClient = {
    messages: {
      async create(params) {
        requests.push(structuredClone(params))
        return { content: replies[i++] ?? [], stop_reason: 'end_turn' }
      },
    },
  }
  return { client, requests }
}

const text = (t: string): Block => [{ type: 'text', text: t, citations: null }]
const use = (name: string, input: unknown, id = 'tu_1'): Block => [
  { type: 'tool_use', id, name, input } as Block[number],
]

const userData: UserData = {
  todos: async () => [{ title: 'Diska', list: 'daily', done: false }],
  schedule: async () => [{ date: '2026-11-06', shift: 'Dag', entries: [] }],
  dayRatings: async () => [],
  garminSummary: async () => ({ averageSleepHours: 7.5 }),
}

function service(replies: Block[], dailyLimit = 100) {
  const { client, requests } = fakeClient(replies)
  const chat = createChatService({
    client,
    model: 'test-model',
    pocketBaseUrl: 'http://pb',
    timeZone: 'Europe/Stockholm',
    dailyLimit,
    now: () => new Date('2026-11-06T10:00:00Z'),
    userData: () => userData,
  })
  return { chat, requests }
}

const ask = (content: string) => [{ role: 'user' as const, content }]

describe('chat service', () => {
  it('answers without tools', async () => {
    const { chat } = service([text('Hej!')])
    assert.deepEqual(await chat.reply('t', ask('Hej')), {
      text: 'Hej!',
      actions: [],
    })
  })

  it('runs a read tool and returns the final answer', async () => {
    const { chat, requests } = service([
      use('get_todos', {}),
      text('Du ska diska.'),
    ])
    const reply = await chat.reply('t', ask('Vad ska jag göra?'))
    assert.equal(reply.text, 'Du ska diska.')
    const second = requests[1] as { messages: { content: unknown }[] }
    assert.match(JSON.stringify(second.messages.at(-1)), /Diska/)
  })

  it('returns write tools as suggestions and never runs them', async () => {
    const { chat } = service([
      use('suggest_todo', { title: 'Bädda sängen', list: 'daily' }),
      text('Jag föreslår det.'),
    ])
    const reply = await chat.reply('t', ask('Lägg till bädda sängen'))
    assert.deepEqual(reply.actions, [
      { type: 'add_todo', list: 'daily', title: 'Bädda sängen' },
    ])
  })

  it('turns a timed suggestion into a schedule entry, else all-day', async () => {
    const { chat } = service([
      [
        ...use('suggest_schedule_entry', {
          title: 'Tandläkare',
          date: '2026-11-10',
          start: '14:00',
          end: '15:00',
        }),
        ...use('suggest_schedule_entry', {
          title: 'Födelsedag',
          date: '2026-11-11',
          start: 'sen',
        }, 'tu_2'),
      ],
      text('Klart.'),
    ])
    const reply = await chat.reply('t', ask('x'))
    assert.deepEqual(reply.actions, [
      {
        type: 'add_schedule_entry',
        title: 'Tandläkare',
        date: '2026-11-10',
        allDay: false,
        start: '14:00',
        end: '15:00',
      },
      {
        type: 'add_schedule_entry',
        title: 'Födelsedag',
        date: '2026-11-11',
        allDay: true,
        start: '',
        end: '',
      },
    ])
  })

  it('rejects invalid suggestions and unknown tools as tool errors', async () => {
    const { chat, requests } = service([
      use('suggest_todo', { title: 'x', list: 'nope' }),
      use('read_mail', {}),
      text('Okej.'),
    ])
    const reply = await chat.reply('t', ask('x'))
    assert.deepEqual(reply.actions, [])
    assert.match(JSON.stringify(requests[2]), /Okänt verktyg/)
  })

  it('has no tool for mail or money', async () => {
    const { chat, requests } = service([text('ok')])
    await chat.reply('t', ask('x'))
    const names = (requests[0] as { tools: { name: string }[] }).tools.map(
      (t) => t.name,
    )
    assert.ok(!names.some((n) => /mail|money|financ|ekonomi/i.test(n)))
  })

  it('stops after the daily limit', async () => {
    const { chat } = service([text('a'), text('b')], 1)
    await chat.reply('t', ask('1'))
    await assert.rejects(chat.reply('t', ask('2')), { message: 'ai_limit' })
  })

  it('reports a refused key separately and gives the expiry in its status', async () => {
    const refused = Object.assign(new Error('invalid x-api-key'), { status: 401 })
    const chat = createChatService({
      client: {
        messages: {
          create: async () => {
            throw refused
          },
        },
      },
      model: 'm',
      pocketBaseUrl: 'http://pb',
      timeZone: 'Europe/Stockholm',
      dailyLimit: 5,
      keyExpires: '2026-12-06',
      userData: () => userData,
    })
    await assert.rejects(chat.reply('t', ask('x')), { message: 'ai_key_invalid' })
    assert.deepEqual(chat.status(), { state: 'ready', keyExpires: '2026-12-06' })
  })

  it('reports an unavailable model', async () => {
    const chat = createChatService({
      client: {
        messages: {
          create: async () => {
            throw new Error('boom')
          },
        },
      },
      model: 'm',
      pocketBaseUrl: 'http://pb',
      timeZone: 'Europe/Stockholm',
      dailyLimit: 5,
      userData: () => userData,
    })
    await assert.rejects(chat.reply('t', ask('x')), { message: 'ai_unavailable' })
  })
})

describe('chat route', () => {
  const ha = createHomeAssistant({ url: 'http://ha', token: 'x' })
  const post = (app: ReturnType<typeof createApp>, body: unknown, auth = true) =>
    app.request('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: 'Bearer user-token' } : {}),
      },
      body: JSON.stringify(body),
    })

  it('requires a signed-in user', async () => {
    const app = createApp(ha, async () => 'invalid')
    assert.equal((await post(app, { messages: [] }, false)).status, 401)
  })

  it('reports the chat as not configured without a key', async () => {
    const app = createApp(ha, async () => 'valid')
    const response = await app.request('/chat/status', {
      headers: { Authorization: 'Bearer user-token' },
    })
    assert.deepEqual(await response.json(), {
      state: 'not_configured',
      keyExpires: null,
    })
  })

  it('is off without an API key', async () => {
    const app = createApp(ha, async () => 'valid')
    const response = await post(app, { messages: ask('hej') })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'ai_not_configured' })
  })

  it('passes the user token and messages to the chat service', async () => {
    const seen: unknown[] = []
    const app = createApp(
      ha,
      async () => 'valid',
      undefined,
      undefined,
      {
        status: () => ({ state: 'ready', keyExpires: null }),
        reply: async (token, messages) => {
          seen.push(token, messages)
          return { text: 'ok', actions: [] }
        },
      },
    )
    const response = await post(app, { messages: ask('hej') })
    assert.equal(response.status, 200)
    assert.deepEqual(seen, ['user-token', ask('hej')])
  })

  it('rejects bad bodies', async () => {
    const app = createApp(ha, async () => 'valid')
    for (const body of [
      {},
      { messages: [] },
      { messages: [{ role: 'system', content: 'x' }] },
      { messages: [{ role: 'assistant', content: 'x' }] },
      { messages: [{ role: 'user', content: ' ' }] },
    ]) {
      assert.equal((await post(app, body)).status, 400)
    }
  })
})

describe('user data', () => {
  it('computes the shift from the cycle and overrides', () => {
    const types = new Map([['a', { id: 'a', name: 'Dag', start: '07:00', end: '16:00' }]])
    const cycle = { startDate: '2026-11-02', days: Array(35).fill('') }
    cycle.days[4] = 'a'
    assert.equal(shiftOn('2026-11-06', cycle, types, new Map()), 'Dag 07:00-16:00')
    assert.equal(shiftOn('2026-11-07', cycle, types, new Map()), 'Ledig')
    assert.equal(
      shiftOn('2026-11-06', cycle, types, new Map([['2026-11-06', { date: '2026-11-06', kind: 'sick', shiftType: '' }]])),
      'Sjuk',
    )
  })

  it('reads with the user token and averages Garmin without zeros', async () => {
    const auths: (string | null)[] = []
    const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
      auths.push(new Headers(init?.headers).get('Authorization'))
      const path = new URL(String(input)).pathname
      if (path.includes('garmin_days')) {
        return Response.json({
          items: [
            { sleep: 28800, steps: 4000, hrvLastNight: 0 },
            { sleep: 25200, steps: 6000, hrvLastNight: 0 },
          ],
        })
      }
      return Response.json({
        items: [{ type: 'running', duration: 1800 }],
      })
    }) as typeof fetch
    const data = createUserData({
      pocketBaseUrl: 'http://pb',
      token: 'user-token',
      fetch: fetchStub,
    })
    const summary = (await data.garminSummary(7, '2026-11-06')) as Record<string, unknown>
    assert.equal(summary.averageSleepHours, 7.5)
    assert.equal(summary.averageSteps, 5000)
    assert.equal(summary.averageHrv, null)
    assert.deepEqual(summary.activities, { running: { count: 1, minutes: 30 } })
    assert.ok(auths.every((a) => a === 'user-token'))
  })

  it('refuses bad dates and long ranges', async () => {
    const data = createUserData({ pocketBaseUrl: 'http://pb', token: 't' })
    await assert.rejects(data.schedule('x', '2026-11-06'))
    await assert.rejects(data.schedule('2026-01-01', '2026-12-31'))
  })
})
