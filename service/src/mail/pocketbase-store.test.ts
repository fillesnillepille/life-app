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
  })
  return { store, calls }
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

  it('fails with a clear message and without the password', async () => {
    const { store } = setup(() => new Response(null, { status: 403 }))
    await assert.rejects(store.create(record), (error: Error) => {
      assert.match(error.message, /403/)
      assert.doesNotMatch(error.message, /secret/)
      return true
    })
  })
})
