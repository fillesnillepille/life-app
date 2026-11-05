import { signOut } from '@/lib/auth'
import { pb } from '@/lib/pocketbase'

export class ServiceError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export async function serviceRequest<T>(
  path: string,
  init?: { method: 'POST'; body?: unknown },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/service${path}`, {
      method: init?.method,
      headers: {
        Authorization: `Bearer ${pb.authStore.token}`,
        ...(init?.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ServiceError('service_unreachable')
  }

  if (response.status === 401) {
    signOut()
    throw new ServiceError('unauthorized')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ServiceError(body?.error ?? 'service_unreachable')
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const errorMessages: Record<string, string> = {
  ha_not_configured: 'Home Assistant är inte kopplat än.',
  ha_auth_failed: 'Home Assistant nekade anslutningen. Kontrollera token.',
  ha_unreachable: 'Kan inte nå Home Assistant.',
  not_found: 'Lampan finns inte längre.',
  auth_unavailable: 'Kan inte kontrollera inloggningen just nu.',
  service_unreachable: 'Kan inte nå tjänsten.',
}

export function serviceErrorMessage(error: unknown) {
  const code = error instanceof ServiceError ? error.code : ''
  return errorMessages[code] ?? 'Något gick fel. Försök igen.'
}
