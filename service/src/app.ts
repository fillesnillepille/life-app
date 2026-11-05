import { Hono } from 'hono'
import type { TokenVerifier } from './auth.ts'
import { HomeAssistantError, type HomeAssistant } from './home-assistant.ts'

const LIGHT_ID = /^light\.[a-z0-9_]+$/
const SCENE_ID = /^scene\.[a-z0-9_]+$/

const errorStatus = {
  ha_not_configured: 503,
  ha_auth_failed: 502,
  ha_unreachable: 502,
  not_found: 404,
} as const

function parseLightChange(body: unknown) {
  if (typeof body !== 'object' || body === null) return null
  const { on, brightness } = body as { on?: unknown; brightness?: unknown }
  if (typeof on !== 'boolean') return null
  if (brightness === undefined) return { on }
  if (
    !on ||
    typeof brightness !== 'number' ||
    !Number.isInteger(brightness) ||
    brightness < 1 ||
    brightness > 100
  ) {
    return null
  }
  return { on, brightness }
}

export function createApp(
  homeAssistant: HomeAssistant,
  verifyToken: TokenVerifier,
) {
  const app = new Hono()

  app.onError((error, c) => {
    if (error instanceof HomeAssistantError) {
      return c.json({ error: error.code }, errorStatus[error.code])
    }
    console.error('Unexpected error:', error.message)
    return c.json({ error: 'internal_error' }, 500)
  })

  app.use('*', async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return c.json({ error: 'unauthorized' }, 401)

    const check = await verifyToken(token)
    if (check === 'invalid') return c.json({ error: 'unauthorized' }, 401)
    if (check === 'unavailable') {
      return c.json({ error: 'auth_unavailable' }, 503)
    }
    await next()
  })

  app.get('/lights', async (c) =>
    c.json(await homeAssistant.listLightsAndScenes()),
  )

  app.post('/lights/:id', async (c) => {
    const id = c.req.param('id')
    if (!LIGHT_ID.test(id)) return c.json({ error: 'invalid_request' }, 400)

    const change = parseLightChange(await c.req.json().catch(() => null))
    if (!change) return c.json({ error: 'invalid_request' }, 400)

    await homeAssistant.setLight(id, change.on, change.brightness)
    return c.body(null, 204)
  })

  app.post('/scenes/:id/activate', async (c) => {
    const id = c.req.param('id')
    if (!SCENE_ID.test(id)) return c.json({ error: 'invalid_request' }, 400)

    await homeAssistant.activateScene(id)
    return c.body(null, 204)
  })

  return app
}
