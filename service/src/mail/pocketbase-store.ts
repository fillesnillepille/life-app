import {
  createPocketBaseClient,
  type PocketBaseClient,
  type PocketBaseOptions,
} from '../pocketbase.ts'
import type { MailRecord, MailStore } from './types.ts'

// Writes the mirrored inbox to PocketBase's `mails` collection. Takes a shared
// client, or the options to make its own.
export function createPocketBaseMailStore(
  client: PocketBaseClient | PocketBaseOptions,
): MailStore {
  const pb = 'collection' in client ? client : createPocketBaseClient(client)
  return pb.collection<MailRecord>('mails')
}
