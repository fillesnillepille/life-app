import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addDays, createGarminSource, todayIn } from './garmin-source.ts'
import { GarminKeyError, GarminRateLimitError } from './types.ts'

type Call = { method: string; path: string; authorization: string | null }

function setup(handler: (call: Call, tokens: number) => Response) {
  const calls: Call[] = []
  let tokens = 0
  let clock = Date.UTC(2026, 10, 6, 12)
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      authorization: new Headers(init?.headers).get('Authorization'),
    }
    calls.push(call)
    if (url.pathname.endsWith('/personal-api-key/token')) {
      tokens++
      return handler(call, tokens)
    }
    return handler(call, tokens)
  }) as typeof fetch
  const source = createGarminSource({
    apiKey: 'garmin-key',
    baseUrl: 'https://garmin.test',
    fetch: fakeFetch,
    now: () => clock,
    gapMs: 0,
  })
  return { source, calls, advance: (ms: number) => (clock += ms) }
}

const tokenResponse = (tokens: number) =>
  Response.json({ access_token: `token-${tokens}`, expires_in: 86400 })

describe('Garmin source', () => {
  it('swaps the key for a token and sends it as a bearer token', async () => {
    const { source, calls } = setup((call, tokens) =>
      call.path.includes('/token') ? tokenResponse(tokens) : Response.json({ data: [] }),
    )
    await source.dailySummaries('2026-11-01', '2026-11-06')
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].authorization, 'ApiKey garmin-key')
    assert.equal(
      calls[1].path,
      '/usersummary-service/v2/dailysummaries?startDate=2026-11-01&endDate=2026-11-06',
    )
    assert.equal(calls[1].authorization, 'Bearer token-1')
  })

  it('reuses the token until it runs out, then gets a new one', async () => {
    const { source, calls, advance } = setup((call, tokens) =>
      call.path.includes('/token') ? tokenResponse(tokens) : Response.json([]),
    )
    await source.sleep('2026-11-06', '2026-11-06')
    await source.sleep('2026-11-06', '2026-11-06')
    assert.equal(calls.filter((c) => c.path.includes('/token')).length, 1)
    advance(24 * 60 * 60_000)
    await source.sleep('2026-11-06', '2026-11-06')
    assert.equal(calls.filter((c) => c.path.includes('/token')).length, 2)
    assert.equal(calls.at(-1)?.authorization, 'Bearer token-2')
  })

  it('gets a new token once when Garmin refuses the old one', async () => {
    const { source, calls } = setup((call, tokens) => {
      if (call.path.includes('/token')) return tokenResponse(tokens)
      return call.authorization === 'Bearer token-1'
        ? new Response(null, { status: 401 })
        : Response.json([])
    })
    await source.hrv('2026-11-06', '2026-11-06')
    assert.equal(calls.filter((c) => c.path.includes('/token')).length, 2)
  })

  it('reports a refused key, and a rate limit', async () => {
    const refused = setup(() => new Response(null, { status: 401 }))
    await assert.rejects(refused.source.hrv('2026-11-06', '2026-11-06'), GarminKeyError)

    const limited = setup((call, tokens) =>
      call.path.includes('/token') ? tokenResponse(tokens) : new Response(null, { status: 429 }),
    )
    await assert.rejects(limited.source.hrv('2026-11-06', '2026-11-06'), GarminRateLimitError)
  })

  it('accepts a token response with other names or none', async () => {
    const { source, calls } = setup((call) =>
      call.path.includes('/token') ? new Response('plain-token') : Response.json([]),
    )
    await source.sleep('2026-11-06', '2026-11-06')
    assert.equal(calls[1].authorization, 'Bearer plain-token')
  })

  it('splits long ranges into pieces of 28 days', async () => {
    const { source, calls } = setup((call, tokens) =>
      call.path.includes('/token')
        ? tokenResponse(tokens)
        : Response.json({ hrvSummaries: [{ calendarDate: 'x' }] }),
    )
    const rows = await source.hrv('2026-10-01', '2026-11-06')
    const paths = calls.filter((c) => c.path.startsWith('/hrv')).map((c) => c.path)
    assert.deepEqual(paths, [
      '/hrv-service/hrv/daily/2026-10-01/2026-10-28',
      '/hrv-service/hrv/daily/2026-10-29/2026-11-06',
    ])
    assert.equal(rows.length, 2)
  })

  it('pages through activities until a short page', async () => {
    const page = (start: number, size: number) =>
      Array.from({ length: size }, (_, i) => ({ activityId: start + i }))
    const { source, calls } = setup((call, tokens) => {
      if (call.path.includes('/token')) return tokenResponse(tokens)
      const start = Number(new URL(`https://x${call.path}`).searchParams.get('start'))
      return Response.json(start === 0 ? page(0, 100) : page(100, 3))
    })
    const rows = await source.activities('2026-10-07', '2026-11-06')
    assert.equal(rows.length, 103)
    const first = new URL(`https://x${calls[1].path}`).searchParams
    assert.equal(first.get('startDate'), '2026-10-07')
    assert.equal(first.get('endDate'), '2026-11-06')
    assert.equal(first.get('excludeChildren'), 'true')
  })

  it('treats an empty answer as no data', async () => {
    const { source } = setup((call, tokens) =>
      call.path.includes('/token') ? tokenResponse(tokens) : new Response(null, { status: 204 }),
    )
    assert.deepEqual(await source.sleep('2026-11-06', '2026-11-06'), [])
  })
})

describe('Garmin dates', () => {
  it('adds days across months', () => {
    assert.equal(addDays('2026-10-30', 3), '2026-11-02')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  })

  it("uses the user's time zone for today", () => {
    // 23:30 UTC on 5 November is already 6 November in Stockholm.
    assert.equal(todayIn('Europe/Stockholm', Date.UTC(2026, 10, 5, 23, 30)), '2026-11-06')
    assert.equal(todayIn('UTC', Date.UTC(2026, 10, 5, 23, 30)), '2026-11-05')
  })
})
