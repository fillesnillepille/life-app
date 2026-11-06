// Talks to PocketBase as the service's own user (service@life-app.local),
// which the collection rules allow to change mail and Garmin data and nothing
// else, so it needs no admin rights. The mail and Garmin stores share one
// client, so they share its sign-in and its pace.
export type PocketBaseOptions = {
  url: string
  email: string
  password: string
  fetch?: typeof fetch
  // PocketBase limits how fast records can be created (by default 20 per 5
  // seconds), so creates are spaced out to stay under that.
  createGapMs?: number
  // Test hook.
  sleep?: (ms: number) => Promise<void>
}

export type PocketBaseClient = ReturnType<typeof createPocketBaseClient>

export function createPocketBaseClient(options: PocketBaseOptions) {
  const doFetch = options.fetch ?? fetch
  const base = options.url.replace(/\/$/, '')
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const createGapMs = options.createGapMs ?? 350
  let token = ''
  let lastCreate = 0

  // Waits until at least createGapMs has passed since the previous create.
  async function paceCreate() {
    const wait = lastCreate + createGapMs - Date.now()
    lastCreate = Math.max(Date.now(), lastCreate + createGapMs)
    if (wait > 0) await sleep(wait)
  }

  async function signIn() {
    const response = await doFetch(
      `${base}/api/collections/users/auth-with-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: options.email,
          password: options.password,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) {
      throw new Error(
        `Could not sign in to PocketBase as the service user (${response.status})`,
      )
    }
    token = ((await response.json()) as { token: string }).token
  }

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!token) await signIn()
    const send = () =>
      doFetch(`${base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      })
    let response = await send()
    if (response.status === 401) {
      // The token ran out, so sign in again once.
      await signIn()
      response = await send()
    }
    // "Too many requests": wait as long as PocketBase says, or back off, and
    // try again a few times before giving up.
    for (let attempt = 1; response.status === 429 && attempt <= 4; attempt++) {
      const advised = Number(response.headers.get('Retry-After'))
      await sleep(
        Number.isFinite(advised) && advised > 0
          ? Math.min(advised, 30) * 1000
          : 2000 * 2 ** (attempt - 1),
      )
      response = await send()
    }
    if (!response.ok) {
      throw new Error(`PocketBase answered ${response.status} for ${init.method ?? 'GET'} ${path.split('?')[0]}`)
    }
    return response
  }

  // Basic record operations on one collection.
  function collection<T extends object>(name: string) {
    const path = `/api/collections/${name}/records`
    return {
      async list(filter?: string): Promise<Array<T & { id: string }>> {
        const rows: Array<T & { id: string }> = []
        const query = filter ? `&filter=${encodeURIComponent(filter)}` : ''
        for (let page = 1; ; page++) {
          const response = await request(`${path}?perPage=200&page=${page}${query}`)
          const body = (await response.json()) as {
            items: Array<T & { id: string }>
            totalPages: number
          }
          rows.push(...body.items)
          if (page >= body.totalPages) return rows
        }
      },
      async create(record: T) {
        await paceCreate()
        await request(path, { method: 'POST', body: JSON.stringify(record) })
      },
      async update(id: string, changes: Partial<T>) {
        await request(`${path}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(changes),
        })
      },
      async remove(id: string) {
        await request(`${path}/${id}`, { method: 'DELETE' })
      },
    }
  }

  return { request, collection }
}
