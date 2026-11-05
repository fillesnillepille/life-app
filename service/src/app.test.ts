import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApp } from './app.ts'
import { createTokenVerifier, type TokenCheck } from './auth.ts'
import { createHomeAssistant } from './home-assistant.ts'
import { noMail } from './mail/sync.ts'
import { MailUnavailableError, type MailService } from './mail/types.ts'

const HA_TOKEN = 'ha-secret-token'
const states = [
  {
    entity_id: 'light.kok',
    state: 'off',
    attributes: { friendly_name: 'Kök', supported_color_modes: ['brightness'] },
  },
  {
    entity_id: 'light.ampel',
    state: 'on',
    attributes: {
      friendly_name: 'Ampel',
      brightness: 128,
      supported_color_modes: ['color_temp', 'xy'],
    },
  },
  {
    entity_id: 'light.trasig',
    state: 'unavailable',
    attributes: { supported_color_modes: ['onoff'] },
  },
  { entity_id: 'scene.film', state: 'unknown', attributes: { friendly_name: 'Film' } },
  { entity_id: 'switch.other', state: 'on', attributes: {} },
]

type Call = { path: string; body?: unknown; authorization: string | null }

function setup(options?: {
  check?: TokenCheck
  haFetch?: typeof fetch
  token?: string
}) {
  const calls: Call[] = []
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    const headers = new Headers(init?.headers)
    calls.push({
      path,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.get('Authorization'),
    })
    if (path === '/api/states') return Response.json(states)
    if (path.startsWith('/api/states/')) {
      const id = path.slice('/api/states/'.length)
      return states.some((state) => state.entity_id === id)
        ? Response.json({})
        : new Response(null, { status: 404 })
    }
    return Response.json([])
  }) as typeof fetch

  const homeAssistant = createHomeAssistant({
    url: 'http://ha.test',
    token: options && 'token' in options ? options.token : HA_TOKEN,
    fetch: options?.haFetch ?? fakeFetch,
  })
  const app = createApp(homeAssistant, async () => options?.check ?? 'valid')
  return { app, calls }
}

const authorized = (init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: 'Bearer user-token', ...init.headers },
})

const postJson = (body: unknown) =>
  authorized({
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('authorization', () => {
  it('rejects requests without a token and never calls Home Assistant', async () => {
    const { app, calls } = setup()
    const response = await app.request('/lights')
    assert.equal(response.status, 401)
    assert.equal(calls.length, 0)
  })

  it('rejects an invalid token', async () => {
    const { app, calls } = setup({ check: 'invalid' })
    const response = await app.request('/lights', authorized())
    assert.equal(response.status, 401)
    assert.equal(calls.length, 0)
  })

  it('reports when login cannot be checked', async () => {
    const { app } = setup({ check: 'unavailable' })
    const response = await app.request('/lights', authorized())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'auth_unavailable' })
  })
})

describe('GET /lights', () => {
  it('returns sorted lights and scenes, and no other entities', async () => {
    const { app } = setup()
    const response = await app.request('/lights', authorized())
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      lights: { id: string }[]
      scenes: { id: string }[]
    }
    assert.deepEqual(body.lights, [
      {
        id: 'light.ampel',
        name: 'Ampel',
        on: true,
        available: true,
        supportsBrightness: true,
        brightness: 50,
      },
      {
        id: 'light.kok',
        name: 'Kök',
        on: false,
        available: true,
        supportsBrightness: true,
        brightness: null,
      },
      {
        id: 'light.trasig',
        name: 'light.trasig',
        on: false,
        available: false,
        supportsBrightness: false,
        brightness: null,
      },
    ])
    assert.deepEqual(body.scenes, [{ id: 'scene.film', name: 'Film' }])
  })

  it('never returns the Home Assistant token', async () => {
    const { app, calls } = setup()
    const response = await app.request('/lights', authorized())
    assert.equal(calls[0]?.authorization, `Bearer ${HA_TOKEN}`)
    assert.ok(!(await response.text()).includes(HA_TOKEN))
  })
})

describe('POST /lights/:id', () => {
  it('turns a light on with a brightness', async () => {
    const { app, calls } = setup()
    const response = await app.request(
      '/lights/light.kok',
      postJson({ on: true, brightness: 40 }),
    )
    assert.equal(response.status, 204)
    assert.deepEqual(calls.at(-1), {
      path: '/api/services/light/turn_on',
      body: { entity_id: 'light.kok', brightness_pct: 40 },
      authorization: `Bearer ${HA_TOKEN}`,
    })
  })

  it('turns a light off', async () => {
    const { app, calls } = setup()
    const response = await app.request('/lights/light.ampel', postJson({ on: false }))
    assert.equal(response.status, 204)
    assert.equal(calls.at(-1)?.path, '/api/services/light/turn_off')
  })

  it('rejects entities that are not lights', async () => {
    const { app, calls } = setup()
    for (const id of ['switch.other', 'lock.front', 'light.a%2Fb', 'light.KOK']) {
      const response = await app.request(`/lights/${id}`, postJson({ on: true }))
      assert.equal(response.status, 400, id)
    }
    assert.equal(calls.length, 0)
  })

  it('rejects invalid changes', async () => {
    const { app, calls } = setup()
    for (const body of [
      {},
      { on: 'yes' },
      { on: true, brightness: 0 },
      { on: true, brightness: 101 },
      { on: true, brightness: 1.5 },
      { on: false, brightness: 50 },
    ]) {
      const response = await app.request('/lights/light.kok', postJson(body))
      assert.equal(response.status, 400, JSON.stringify(body))
    }
    assert.equal(calls.length, 0)
  })

  it('returns 404 for an unknown light', async () => {
    const { app, calls } = setup()
    const response = await app.request('/lights/light.finns_inte', postJson({ on: true }))
    assert.equal(response.status, 404)
    assert.ok(!calls.some((call) => call.path.includes('/services/')))
  })
})

describe('POST /scenes/:id/activate', () => {
  it('activates a scene', async () => {
    const { app, calls } = setup()
    const response = await app.request(
      '/scenes/scene.film/activate',
      authorized({ method: 'POST' }),
    )
    assert.equal(response.status, 204)
    assert.deepEqual(calls.at(-1)?.body, { entity_id: 'scene.film' })
    assert.equal(calls.at(-1)?.path, '/api/services/scene/turn_on')
  })

  it('rejects other entity types', async () => {
    const { app, calls } = setup()
    const response = await app.request(
      '/scenes/light.kok/activate',
      authorized({ method: 'POST' }),
    )
    assert.equal(response.status, 400)
    assert.equal(calls.length, 0)
  })
})

describe('Home Assistant failures', () => {
  const expectError = async (
    options: Parameters<typeof setup>[0],
    status: number,
    error: string,
  ) => {
    const { app } = setup(options)
    const response = await app.request('/lights', authorized())
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), { error })
  }

  it('reports a missing token', () =>
    expectError({ token: undefined }, 503, 'ha_not_configured'))

  it('reports a rejected token', () =>
    expectError(
      { haFetch: (async () => new Response(null, { status: 401 })) as typeof fetch },
      502,
      'ha_auth_failed',
    ))

  it('reports an unreachable server', () =>
    expectError(
      {
        haFetch: (async () => {
          throw new TypeError('connection refused')
        }) as typeof fetch,
      },
      502,
      'ha_unreachable',
    ))
})

describe('token verifier', () => {
  const pocketBase = (response: () => Response) => {
    let calls = 0
    const doFetch = (async () => {
      calls += 1
      return response()
    }) as typeof fetch
    return { verify: createTokenVerifier('http://pb.test', doFetch), count: () => calls }
  }

  it('accepts a token that can see its own user, and caches it', async () => {
    const { verify, count } = pocketBase(() => Response.json({ items: [{ id: 'a' }] }))
    assert.equal(await verify('token'), 'valid')
    assert.equal(await verify('token'), 'valid')
    assert.equal(count(), 1)
  })

  it('rejects a guest, which PocketBase answers with no items', async () => {
    const { verify, count } = pocketBase(() => Response.json({ items: [] }))
    assert.equal(await verify('token'), 'invalid')
    assert.equal(await verify('token'), 'invalid')
    assert.equal(count(), 2)
  })

  it('rejects when PocketBase answers 401', async () => {
    const { verify } = pocketBase(() => new Response(null, { status: 401 }))
    assert.equal(await verify('token'), 'invalid')
  })

  it('reports when PocketBase is down', async () => {
    const verify = createTokenVerifier('http://pb.test', (async () => {
      throw new TypeError('connection refused')
    }) as typeof fetch)
    assert.equal(await verify('token'), 'unavailable')
  })
})

describe('mail status', () => {
  const haFetch = (async () => Response.json([])) as typeof fetch

  it('requires a signed-in user', async () => {
    const homeAssistant = createHomeAssistant({ url: 'http://ha.test', token: 'x', fetch: haFetch })
    const app = createApp(homeAssistant, async () => 'invalid')
    const response = await app.request('/mail/status', {
      headers: { Authorization: 'Bearer nope' },
    })
    assert.equal(response.status, 401)
  })

  it('says mail is not configured when no mailbox is set up', async () => {
    const { app } = setup()
    const response = await app.request('/mail/status', authorized())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      state: 'not_configured',
      account: null,
      lastSync: null,
      count: 0,
      error: null,
    })
  })

  it('reports the status of the running sync', async () => {
    const homeAssistant = createHomeAssistant({ url: 'http://ha.test', token: 'x', fetch: haFetch })
    const status = {
      state: 'connected' as const,
      account: 'me@example.test',
      lastSync: '2026-11-05T12:00:00.000Z',
      count: 12,
      error: null,
    }
    const app = createApp(homeAssistant, async () => 'valid', {
      ...noMail,
      status: () => status,
    })
    const response = await app.request('/mail/status', authorized())
    assert.deepEqual(await response.json(), status)
  })
})

describe('mail messages', () => {
  const haFetch = (async () => Response.json([])) as typeof fetch
  const body = {
    subject: 'Hej',
    fromName: 'Anna',
    fromAddress: 'anna@example.test',
    date: '2026-11-05T10:00:00.000Z',
    text: 'Hela texten',
    html: '<p>Hela texten</p>',
    attachments: [{ filename: 'a.pdf', size: 10 }],
    truncated: false,
  }

  function mailApp(overrides: Partial<MailService> = {}) {
    const calls: string[] = []
    const mail: MailService = {
      status: noMail.status,
      async read(validity, uid) {
        calls.push(`read ${validity}:${uid}`)
        return validity === 7 && uid === 1 ? body : null
      },
      async markSeen(validity, uid) {
        calls.push(`seen ${validity}:${uid}`)
        return validity === 7 && uid === 1
      },
      async trash(validity, uid) {
        calls.push(`trash ${validity}:${uid}`)
        return validity === 7 && uid === 1
      },
      ...overrides,
    }
    const homeAssistant = createHomeAssistant({ url: 'http://ha.test', token: 'x', fetch: haFetch })
    return { app: createApp(homeAssistant, async () => 'valid', mail), calls }
  }

  it('returns a whole message', async () => {
    const { app } = mailApp()
    const response = await app.request('/mail/messages/7/1', authorized())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), body)
  })

  it('answers 404 for a message that is gone', async () => {
    const { app } = mailApp()
    const response = await app.request('/mail/messages/7/99', authorized())
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'mail_not_found' })
  })

  it('marks a message as read and moves it to the trash', async () => {
    const { app, calls } = mailApp()
    assert.equal((await app.request('/mail/messages/7/1/seen', authorized({ method: 'POST' }))).status, 204)
    assert.equal((await app.request('/mail/messages/7/1/trash', authorized({ method: 'POST' }))).status, 204)
    assert.deepEqual(calls, ['seen 7:1', 'trash 7:1'])
  })

  it('answers 404 when trashing something that is gone', async () => {
    const { app } = mailApp()
    const response = await app.request('/mail/messages/7/99/trash', authorized({ method: 'POST' }))
    assert.equal(response.status, 404)
  })

  it('rejects ids that are not plain numbers, without asking the mailbox', async () => {
    const { app, calls } = mailApp()
    for (const path of ['/mail/messages/7/abc', '/mail/messages/x/1', '/mail/messages/7/1%20OR%201/trash']) {
      const response = await app.request(path, authorized({ method: path.endsWith('trash') ? 'POST' : 'GET' }))
      assert.equal(response.status, 400, path)
    }
    assert.deepEqual(calls, [])
  })

  it('requires a signed-in user for every message route', async () => {
    const homeAssistant = createHomeAssistant({ url: 'http://ha.test', token: 'x', fetch: haFetch })
    const app = createApp(homeAssistant, async () => 'invalid', noMail)
    for (const [method, path] of [['GET', '/mail/messages/7/1'], ['POST', '/mail/messages/7/1/seen'], ['POST', '/mail/messages/7/1/trash']] as const) {
      const response = await app.request(path, { method, headers: { Authorization: 'Bearer nope' } })
      assert.equal(response.status, 401, path)
    }
  })

  it('says so when the mailbox is unreachable', async () => {
    const { app } = mailApp({
      async read() {
        throw new MailUnavailableError()
      },
    })
    const response = await app.request('/mail/messages/7/1', authorized())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'mail_unavailable' })
  })

  it('says so when no mailbox is set up', async () => {
    const { app } = setup()
    const response = await app.request('/mail/messages/7/1', authorized())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'mail_not_configured' })
  })
})
