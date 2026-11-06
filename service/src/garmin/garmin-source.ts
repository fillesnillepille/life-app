import {
  GarminKeyError,
  GarminRateLimitError,
  type GarminSource,
} from './types.ts'

const BASE = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
// Access tokens last 24 hours. Get a new one a little before that.
const TOKEN_FALLBACK_MS = 23 * 60 * 60_000
const PAGE_SIZE = 100
// A safety limit on paging: 50 pages is 5,000 activities.
const MAX_PAGES = 50
// Garmin's range endpoints take at most 31 days, or 28 for some, so ranges
// are split into pieces of this many days.
const CHUNK_DAYS = 28
// The daily summaries take up to a year at a time.
const SUMMARY_CHUNK_DAYS = 360

// Reads from Garmin Connect's Personal API with a personal API key. The key
// is swapped for an access token that lasts 24 hours, and there are no
// refresh tokens, so a new one is fetched with the key when it runs out.
// Read-only: there's no function here that changes anything at Garmin.
export function createGarminSource(options: {
  apiKey: string
  baseUrl?: string
  fetch?: typeof fetch
  now?: () => number
  // Time between requests, to go easy on Garmin. Test hook.
  gapMs?: number
  sleep?: (ms: number) => Promise<void>
}): GarminSource {
  const doFetch = options.fetch ?? fetch
  const base = (options.baseUrl ?? BASE).replace(/\/$/, '')
  const now = options.now ?? Date.now
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const gapMs = options.gapMs ?? 500
  let token = ''
  let tokenUntil = 0
  let lastRequest = 0

  async function send(url: string, init: RequestInit) {
    const wait = lastRequest + gapMs - now()
    if (wait > 0) await sleep(wait)
    lastRequest = now()
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
    } catch (error) {
      throw new Error('unreachable', { cause: error })
    }
  }

  async function newToken() {
    const response = await send(`${base}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${options.apiKey}` },
    })
    if (response.status === 401 || response.status === 403) {
      throw new GarminKeyError()
    }
    if (response.status === 429) throw new GarminRateLimitError()
    if (!response.ok) throw new Error(`Garmin token request answered ${response.status}`)
    // Garmin's documentation doesn't show the response, so accept the usual
    // OAuth2 names and a plain token.
    const text = await response.text()
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      body = { access_token: text.trim() }
    }
    const value = body.access_token ?? body.accessToken ?? body.token
    if (typeof value !== 'string' || !value) {
      throw new Error('Garmin token response had no token')
    }
    const seconds = Number(body.expires_in ?? body.expiresIn)
    token = value
    tokenUntil =
      now() +
      (Number.isFinite(seconds) && seconds > 120
        ? (seconds - 60) * 1000
        : TOKEN_FALLBACK_MS)
  }

  async function get(path: string): Promise<unknown> {
    if (!token || now() >= tokenUntil) await newToken()
    const call = () =>
      send(`${base}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
    let response = await call()
    if (response.status === 401) {
      // The token may have been dropped early. Get a new one once.
      await newToken()
      response = await call()
      if (response.status === 401) throw new GarminKeyError()
    }
    if (response.status === 429) throw new GarminRateLimitError()
    // No data for a range comes back as 204 or 404 from some endpoints.
    if (response.status === 204 || response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Garmin answered ${response.status} for ${path.split('?')[0]}`)
    }
    const text = await response.text()
    return text ? (JSON.parse(text) as unknown) : null
  }

  // Calls `fetchRange` for each piece of a date range and joins the results.
  async function inChunks(
    from: string,
    to: string,
    size: number,
    fetchRange: (from: string, to: string) => Promise<unknown[]>,
  ) {
    const rows: unknown[] = []
    for (let start = from; start <= to; start = addDays(start, size)) {
      const end = minDate(addDays(start, size - 1), to)
      rows.push(...(await fetchRange(start, end)))
    }
    return rows
  }

  const asArray = (value: unknown, key?: string): unknown[] => {
    if (Array.isArray(value)) return value
    if (key && value && typeof value === 'object') {
      const inner = (value as Record<string, unknown>)[key]
      if (Array.isArray(inner)) return inner
    }
    return []
  }

  return {
    async activities(from, to) {
      const rows: unknown[] = []
      for (let page = 0; page < MAX_PAGES; page++) {
        const query = new URLSearchParams({
          start: String(page * PAGE_SIZE),
          limit: String(PAGE_SIZE),
          sortOrder: 'desc',
          // A multisport activity counts once, not once per leg.
          excludeChildren: 'true',
        })
        if (from) query.set('startDate', from)
        if (to) query.set('endDate', to)
        const batch = asArray(
          await get(`/activitylist-service/activities/search/activities?${query}`),
        )
        rows.push(...batch)
        if (batch.length < PAGE_SIZE) return rows
      }
      throw new Error('Too many activities to page through')
    },

    dailySummaries: (from, to) =>
      inChunks(from, to, SUMMARY_CHUNK_DAYS, async (start, end) =>
        asArray(
          await get(
            `/usersummary-service/v2/dailysummaries?startDate=${start}&endDate=${end}`,
          ),
          'data',
        ),
      ),

    sleep: (from, to) =>
      inChunks(from, to, CHUNK_DAYS, async (start, end) =>
        asArray(
          await get(
            `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${start}&endDate=${end}`,
          ),
        ),
      ),

    hrv: (from, to) =>
      inChunks(from, to, CHUNK_DAYS, async (start, end) =>
        asArray(await get(`/hrv-service/hrv/daily/${start}/${end}`), 'hrvSummaries'),
      ),
  }
}

// Date keys -----------------------------------------------------------------

export function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const minDate = (a: string, b: string) => (a < b ? a : b)

// Today's date where the user lives, as "2026-11-06". The service may run
// in UTC, so the time zone is given rather than taken from the machine.
export function todayIn(timeZone: string, now: number) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
