import PocketBase from 'pocketbase'

// In development PocketBase runs on its own port. In production the reverse
// proxy serves it from the same address as the app.
export const pocketbaseUrl =
  import.meta.env.VITE_POCKETBASE_URL ??
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin)

export const pb = new PocketBase(pocketbaseUrl)
