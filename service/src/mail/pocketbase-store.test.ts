import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPocketBaseMailStore } from './pocketbase-store.ts'
import type { MailRecord } from './types.ts'

const record: MailRecord = {
  uid: 1,
  uidValidity: 1,
  messageId: '<a@b>',
  threadId: '9',
  fromAddress: 'a@b.test',
  fromName: 'A',
  subject: 'Hej',
  date: '2026-11-05T10:00:00.000Z',
  snippet: '',
  bucket: 'important',
  seen: false,
  sensitive: false,
  bulk: false,
}

type Call = { method: string; path: string; authorization: string | null; body?: unknown }

function setup(handler: (call: Call, signIns: number) => Response) {
  const calls: Call[] = []
  const sleeps: number[] = []
  let signIns = 0
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      authorization: new Headers(init?.headers).get('Authorization'),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    if (url.pathname.endsWith('/auth-with-password')) {
      signIns++
      return Response.json({ token: `token-${signIns}` })
    }
    return handler(call, signIns)
  }) as typeof fetch
  const store = createPocketBaseMailStore({
    url: 'http://pb.test/',
    email: 'service@life-app.local',
    password: 'secret',
    fetch: fakeFetch,
    createGapMs: 100,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  })
  return { store, calls, sleeps }
}

describe('PocketBase mail store', () => {
  it('signs in as the service user and sends its token', async () => {
    const { store, calls } = setup(() => Response.json({}))
    await store.create(record)
    assert.equal(calls[0].path, '/api/collections/users/auth-with-password')
    assert.deepEqual(calls[0].body, {
      identity: 'service@life-app.local',
      password: 'secret',
    })
    assert.equal(calls[1].method, 'POST')
    assert.equal(calls[1].path, '/api/collections/mails/records')
    assert.equal(calls[1].authorization, 'token-1')
    assert.deepEqual(calls[1].body, record)
  })

  it('signs in only once for several requests', async () => {
    const { store, calls } = setup(() => Response.json({}))
    await store.create(record)
    await store.update('abc', { seen: true })
    await store.remove('abc')
    assert.equal(calls.filter((c) => c.path.includes('auth-with-password')).length, 1)
    assert.equal(calls[2].method, 'PATCH')
    assert.equal(calls[2].path, '/api/collections/mails/records/abc')
    assert.equal(calls[3].method, 'DELETE')
  })

  it('signs in again when the token is rejected', async () => {
    const { store, calls } = setup((call) =>
      call.authorization === 'token-1'
        ? new Response(null, { status: 401 })
        : Response.json({}),
    )
    await store.create(record)
    const writes = calls.filter((c) => c.path === '/api/collections/mails/records')
    assert.deepEqual(writes.map((c) => c.authorization), ['token-1', 'token-2'])
  })

  it('reads every page of stored mail', async () => {
    const { store } = setup((call) => {
      const page = Number(new URL(`http://x${call.path}`).searchParams.get('page'))
      return Response.json({
        items: [{ ...record, id: `r${page}`, uid: page }],
        totalPages: 3,
      })
    })
    const rows = await store.list()
    assert.deepEqual(rows.map((r) => r.id), ['r1', 'r2', 'r3'])
  })

  it('waits and tries again when PocketBase says too many requests', async () => {
    let writes = 0
    const { store, sleeps } = setup((call) =>
      call.path === '/api/collections/mails/records' && ++writes === 1
        ? new Response(null, { status: 429 })
        : Response.json({}),
    )
    await store.create(record)
    assert.equal(writes, 2)
    assert.deepEqual(sleeps, [2000])
  })

  it('uses the wait PocketBase advises, but never more than 30 seconds', async () => {
    const answers = [
      new Response(null, { status: 429, headers: { 'Retry-After': '7' } }),
      new Response(null, { status: 429, headers: { 'Retry-After': '999' } }),
    ]
    const { store, sleeps } = setup((call) =>
      call.path.startsWith('/api/collections/mails/records/abc')
        ? (answers.shift() ?? Response.json({}))
        : Response.json({}),
    )
    await store.update('abc', { seen: true })
    assert.deepEqual(sleeps, [7000, 30000])
  })

  it('gives up after a few tries and says why', async () => {
    const { store, calls } = setup(() => new Response(null, { status: 429 }))
    await assert.rejects(store.remove('abc'), /429/)
    assert.equal(calls.filter((c) => c.method === 'DELETE').length, 5)
  })

  it('spaces out creates but not other writes', async () => {
    const { store, sleeps } = setup(() => Response.json({}))
    await store.create(record)
    await store.create({ ...record, uid: 2 })
    await store.create({ ...record, uid: 3 })
    await store.update('abc', { seen: true })
    // The first create goes straight away; the next two wait for their turn.
    assert.equal(sleeps.length, 2)
    assert.ok(sleeps.every((ms) => ms > 0 && ms <= 200))
  })

  it('fails with a clear message and without the password', async () => {
    const { store } = setup(() => new Response(null, { status: 403 }))
    await assert.rejects(store.create(record), (error: Error) => {
      assert.match(error.message, /403/)
      assert.doesNotMatch(error.message, /secret/)
      return true
    })
  })
})
