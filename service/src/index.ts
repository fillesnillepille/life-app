import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createTokenVerifier } from './auth.ts'
import { createHomeAssistant } from './home-assistant.ts'
import { createGmailSource } from './mail/gmail-source.ts'
import { createPocketBaseMailStore } from './mail/pocketbase-store.ts'
import { createMailSync, notConfigured } from './mail/sync.ts'

const {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN,
  POCKETBASE_URL = 'http://127.0.0.1:8090',
  POCKETBASE_SERVICE_EMAIL,
  POCKETBASE_SERVICE_PASSWORD,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  HOST = '127.0.0.1',
  PORT = '8787',
} = process.env

// Mail is optional. It only starts when the Gmail login and the service user
// are both set, so a development copy without them never touches the mailbox.
const mailSync =
  GMAIL_USER &&
  GMAIL_APP_PASSWORD &&
  POCKETBASE_SERVICE_EMAIL &&
  POCKETBASE_SERVICE_PASSWORD
    ? createMailSync({
        account: GMAIL_USER,
        source: createGmailSource({
          user: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        }),
        store: createPocketBaseMailStore({
          url: POCKETBASE_URL,
          email: POCKETBASE_SERVICE_EMAIL,
          password: POCKETBASE_SERVICE_PASSWORD,
        }),
      })
    : undefined

const app = createApp(
  createHomeAssistant({ url: HOME_ASSISTANT_URL, token: HOME_ASSISTANT_TOKEN }),
  createTokenVerifier(POCKETBASE_URL),
  mailSync ?? { status: () => notConfigured },
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
})

// Close the Gmail connection politely when Docker stops the container.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void (mailSync?.stop() ?? Promise.resolve()).finally(() => process.exit(0))
  })
}
