export type ServiceErrorCode =
  | 'ha_not_configured'
  | 'ha_auth_failed'
  | 'ha_unreachable'
  | 'not_found'

export class HomeAssistantError extends Error {
  code: ServiceErrorCode

  constructor(code: ServiceErrorCode) {
    super(code)
    this.code = code
  }
}

export type Light = {
  id: string
  name: string
  on: boolean
  available: boolean
  supportsBrightness: boolean
  brightness: number | null
}

export type Scene = { id: string; name: string }

type HomeAssistantState = {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    brightness?: number | null
    supported_color_modes?: string[]
  }
}

function toLight(state: HomeAssistantState): Light {
  const { friendly_name, brightness, supported_color_modes } = state.attributes
  const modes = supported_color_modes ?? []
  return {
    id: state.entity_id,
    name: friendly_name ?? state.entity_id,
    on: state.state === 'on',
    available: state.state !== 'unavailable' && state.state !== 'unknown',
    supportsBrightness: modes.some((mode) => mode !== 'onoff'),
    brightness:
      typeof brightness === 'number' ? Math.round((brightness / 255) * 100) : null,
  }
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'sv')

export type HomeAssistantOptions = {
  url: string | undefined
  token: string | undefined
  fetch?: typeof fetch
}

export function createHomeAssistant(options: HomeAssistantOptions) {
  const { url, token, fetch: doFetch = fetch } = options

  async function request(path: string, init?: RequestInit) {
    if (!url || !token) throw new HomeAssistantError('ha_not_configured')

    let response: Response
    try {
      response = await doFetch(`${url.replace(/\/$/, '')}/api${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      throw new HomeAssistantError('ha_unreachable')
    }

    if (response.status === 401 || response.status === 403) {
      throw new HomeAssistantError('ha_auth_failed')
    }
    if (response.status === 404) throw new HomeAssistantError('not_found')
    if (!response.ok) throw new HomeAssistantError('ha_unreachable')
    return response
  }

  async function getStates(): Promise<HomeAssistantState[]> {
    const response = await request('/states')
    return (await response.json()) as HomeAssistantState[]
  }

  async function callService(domain: string, service: string, body: object) {
    await request(`/services/${domain}/${service}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  return {
    async listLightsAndScenes(): Promise<{ lights: Light[]; scenes: Scene[] }> {
      const states = await getStates()
      return {
        lights: states
          .filter((state) => state.entity_id.startsWith('light.'))
          .map(toLight)
          .sort(byName),
        scenes: states
          .filter((state) => state.entity_id.startsWith('scene.'))
          .map((state) => ({
            id: state.entity_id,
            name: state.attributes.friendly_name ?? state.entity_id,
          }))
          .sort(byName),
      }
    },

    async setLight(id: string, on: boolean, brightness?: number) {
      await request(`/states/${id}`)
      if (on) {
        await callService('light', 'turn_on', {
          entity_id: id,
          ...(brightness === undefined ? {} : { brightness_pct: brightness }),
        })
      } else {
        await callService('light', 'turn_off', { entity_id: id })
      }
    },

    async activateScene(id: string) {
      await request(`/states/${id}`)
      await callService('scene', 'turn_on', { entity_id: id })
    },
  }
}

export type HomeAssistant = ReturnType<typeof createHomeAssistant>
