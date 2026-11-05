export type TokenCheck = 'valid' | 'invalid' | 'unavailable'

const CACHE_MS = 30_000

// Asks PocketBase whether a browser's token belongs to a signed-in user. The
// users list rule only returns a user's own record, so a guest gets no items.
export function createTokenVerifier(
  pocketBaseUrl: string,
  doFetch: typeof fetch = fetch,
) {
  const validUntil = new Map<string, number>()
  const url = `${pocketBaseUrl.replace(/\/$/, '')}/api/collections/users/records?perPage=1&fields=id`

  return async function verifyToken(token: string): Promise<TokenCheck> {
    const now = Date.now()
    if ((validUntil.get(token) ?? 0) > now) return 'valid'

    for (const [cached, until] of validUntil) {
      if (until <= now) validUntil.delete(cached)
    }

    let response: Response
    try {
      response = await doFetch(url, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      return 'unavailable'
    }

    if (response.status === 401 || response.status === 403) return 'invalid'
    if (!response.ok) return 'unavailable'

    const { items } = (await response.json()) as { items: unknown[] }
    if (items.length === 0) return 'invalid'

    validUntil.set(token, now + CACHE_MS)
    return 'valid'
  }
}

export type TokenVerifier = ReturnType<typeof createTokenVerifier>
