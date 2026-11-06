import { Hono } from 'hono'
import type { TokenVerifier } from './auth.ts'
import { HomeAssistantError, type HomeAssistant } from './home-assistant.ts'
import { noGarmin } from './garmin/sync.ts'
import type { GarminService } from './garmin/types.ts'
import { noMail } from './mail/sync.ts'
import {
  MailNotConfiguredError,
  MailUnavailableError,
  type MailService,
} from './mail/types.ts'

const LIGHT_ID = /^light\.[a-z0-9_]+$/
const SCENE_ID = /^scene\.[a-z0-9_]+$/
const NUMBER = /^\d{1,15}$/

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
  mail: MailService = noMail,
  garmin: GarminService = noGarmin,
) {
  const app = new Hono()

  app.onError((error, c) => {
    if (error instanceof HomeAssistantError) {
      return c.json({ error: error.code }, errorStatus[error.code])
    }
    if (
      error instanceof MailUnavailableError ||
      error instanceof MailNotConfiguredError
    ) {
      return c.json({ error: error.message }, 503)
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

  app.get('/mail/status', (c) => c.json(mail.status()))

  // Garmin is read-only: the app can ask how the sync is doing and start one
  // now, and nothing else.
  app.get('/garmin/status', (c) => c.json(garmin.status()))
  app.post('/garmin/sync', async (c) => c.json(await garmin.syncNow()))

  // A message is named by the mailbox's validity number and its UID, the same
  // pair the app stores. If the mailbox was reset since, the pair no longer
  // matches anything and the message counts as gone.
  const messageRef = (c: { req: { param: (name: string) => string } }) => {
    const validity = c.req.param('uidValidity')
    const uid = c.req.param('uid')
    if (!NUMBER.test(validity) || !NUMBER.test(uid)) return null
    return { validity: Number(validity), uid: Number(uid) }
  }

  app.get('/mail/messages/:uidValidity/:uid', async (c) => {
    const ref = messageRef(c)
    if (!ref) return c.json({ error: 'invalid_request' }, 400)
    const body = await mail.read(ref.validity, ref.uid)
    return body ? c.json(body) : c.json({ error: 'mail_not_found' }, 404)
  })

  app.post('/mail/messages/:uidValidity/:uid/seen', async (c) => {
    const ref = messageRef(c)
    if (!ref) return c.json({ error: 'invalid_request' }, 400)
    return (await mail.markSeen(ref.validity, ref.uid))
      ? c.body(null, 204)
      : c.json({ error: 'mail_not_found' }, 404)
  })

  app.post('/mail/messages/:uidValidity/:uid/trash', async (c) => {
    const ref = messageRef(c)
    if (!ref) return c.json({ error: 'invalid_request' }, 400)
    return (await mail.trash(ref.validity, ref.uid))
      ? c.body(null, 204)
      : c.json({ error: 'mail_not_found' }, 404)
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
