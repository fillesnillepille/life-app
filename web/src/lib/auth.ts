import { useSyncExternalStore } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from '@/lib/pocketbase'

const subscribe = (onChange: () => void) => pb.authStore.onChange(onChange)
const getIsSignedIn = () => pb.authStore.isValid

export function useIsSignedIn() {
  return useSyncExternalStore(subscribe, getIsSignedIn)
}

export async function signIn(email: string, password: string) {
  await pb.collection('users').authWithPassword(email, password, {
    requestKey: null,
  })
}

export function signOut() {
  pb.authStore.clear()
}

// Renews a saved session on startup. A failed network request keeps the
// session, but a rejected token ends it.
export async function refreshSession() {
  if (!pb.authStore.isValid) return
  try {
    await pb.collection('users').authRefresh({ requestKey: null })
  } catch (error) {
    if (error instanceof ClientResponseError && error.status !== 0) {
      signOut()
    }
  }
}
