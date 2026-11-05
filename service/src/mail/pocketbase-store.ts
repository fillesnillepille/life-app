import type { MailRecord, MailStore } from './types.ts'

type Row = MailRecord & { id: string }

// Writes the mirrored inbox to PocketBase. It signs in as a dedicated user
// (service@life-app.local) that the collection rules allow to change mail and
// nothing else, so it needs no admin rights.
export function createPocketBaseMailStore(options: {
  url: string
  email: string
  password: string
  fetch?: typeof fetch
}): MailStore {
  const doFetch = options.fetch ?? fetch
  const base = options.url.replace(/\/$/, '')
  let token = ''

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
    if (!response.ok) {
      throw new Error(`PocketBase answered ${response.status} for ${init.method ?? 'GET'} ${path.split('?')[0]}`)
    }
    return response
  }

  return {
    async list() {
      const rows: Row[] = []
      for (let page = 1; ; page++) {
        const response = await request(
          `/api/collections/mails/records?perPage=200&page=${page}`,
        )
        const body = (await response.json()) as {
          items: Row[]
          totalPages: number
        }
        rows.push(...body.items)
        if (page >= body.totalPages) return rows
      }
    },
    async create(record) {
      await request('/api/collections/mails/records', {
        method: 'POST',
        body: JSON.stringify(record),
      })
    },
    async update(id, changes) {
      await request(`/api/collections/mails/records/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
    },
    async remove(id) {
      await request(`/api/collections/mails/records/${id}`, { method: 'DELETE' })
    },
  }
}
