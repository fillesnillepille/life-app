import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createTokenVerifier } from './auth.ts'
import { createHomeAssistant } from './home-assistant.ts'

const {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN,
  POCKETBASE_URL = 'http://127.0.0.1:8090',
  HOST = '127.0.0.1',
  PORT = '8787',
} = process.env

const app = createApp(
  createHomeAssistant({ url: HOME_ASSISTANT_URL, token: HOME_ASSISTANT_TOKEN }),
  createTokenVerifier(POCKETBASE_URL),
)

serve({ fetch: app.fetch, hostname: HOST, port: Number(PORT) }, (info) => {
  console.log(`Service listening on ${HOST}:${info.port}`)
  if (!HOME_ASSISTANT_URL || !HOME_ASSISTANT_TOKEN) {
    console.warn('Home Assistant is not configured. See service/.env.example.')
  }
})
