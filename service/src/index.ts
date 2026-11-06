import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createTokenVerifier } from './auth.ts'
import { createGarminSource } from './garmin/garmin-source.ts'
import { createPocketBaseGarminStore } from './garmin/pocketbase-store.ts'
import { createGarminSync, noGarmin } from './garmin/sync.ts'
import { createHomeAssistant } from './home-assistant.ts'
import { createGmailSource } from './mail/gmail-source.ts'
import { createPocketBaseMailStore } from './mail/pocketbase-store.ts'
import { createMailSync, noMail } from './mail/sync.ts'
import { createPocketBaseClient } from './pocketbase.ts'

const {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN,
  POCKETBASE_URL = 'http://127.0.0.1:8090',
  POCKETBASE_SERVICE_EMAIL,
  POCKETBASE_SERVICE_PASSWORD,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  GARMIN_API_KEY,
  GARMIN_API_KEY_EXPIRES,
  GARMIN_TIME_ZONE = 'Europe/Stockholm',
  HOST = '127.0.0.1',
  PORT = '8787',
} = process.env

// The service's own PocketBase user, shared by mail and Garmin so they share
// one sign-in and one pace for creating records.
const pocketBase =
  POCKETBASE_SERVICE_EMAIL && POCKETBASE_SERVICE_PASSWORD
    ? createPocketBaseClient({
        url: POCKETBASE_URL,
        email: POCKETBASE_SERVICE_EMAIL,
        password: POCKETBASE_SERVICE_PASSWORD,
      })
    : undefined

// Mail is optional. It only starts when the Gmail login and the service user
// are both set, so a development copy without them never touches the mailbox.
const mailSync =
  GMAIL_USER && GMAIL_APP_PASSWORD && pocketBase
    ? createMailSync({
        account: GMAIL_USER,
        source: createGmailSource({
          user: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        }),
        store: createPocketBaseMailStore(pocketBase),
      })
    : undefined

// Garmin is optional too, and only starts with an API key and the service
// user. The key's expiry date is optional and only used for a reminder.
const expires = /^\d{4}-\d{2}-\d{2}$/.test(GARMIN_API_KEY_EXPIRES ?? '')
  ? GARMIN_API_KEY_EXPIRES
  : null
const garminSync =
  GARMIN_API_KEY && pocketBase
    ? createGarminSync({
        source: createGarminSource({ apiKey: GARMIN_API_KEY }),
        store: createPocketBaseGarminStore(pocketBase),
        timeZone: GARMIN_TIME_ZONE,
        keyExpires: expires,
      })
    : undefined

const app = createApp(
  createHomeAssistant({ url: HOME_ASSISTANT_URL, token: HOME_ASSISTANT_TOKEN }),
  createTokenVerifier(POCKETBASE_URL),
  mailSync ?? noMail,
  garminSync ?? noGarmin,
)

serve({ fetch: app.fetch, hostname: HOST, port: Number(PORT) }, (info) => {
  console.log(`Service listening on ${HOST}:${info.port}`)
  if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
    console.warn('Home Assistant is not configured. See service/.env.example.')
  }
  if (mailSync) {
    // In the background, so the service answers requests while Gmail connects.
    void mailSync.start()
  } else {
    console.warn('Mail is not configured. See service/.env.example.')
  }
  if (garminSync) {
    garminSync.start()
  } else {
    console.warn('Garmin is not configured. See service/.env.example.')
  }
})

// Close the Gmail connection politely when Docker stops the container.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    garminSync?.stop()
    void (mailSync?.stop() ?? Promise.resolve()).finally(() => process.exit(0))
  })
}
