import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMailSync } from './sync.ts'
import type {
  MailMessage,
  MailRecord,
  MailSource,
  MailStore,
} from './types.ts'

function message(uid: number, overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    uid,
    uidValidity: 1,
    messageId: `<${uid}@example.test>`,
    threadId: String(uid),
    fromAddress: 'anna@example.test',
    fromName: 'Anna',
    subject: `Ämne ${uid}`,
    date: '2026-11-05T10:00:00.000Z',
    body: 'Text',
    seen: false,
    labels: [],
    headers: {
      listUnsubscribe: false,
      listId: false,
      precedence: '',
      autoSubmitted: false,
    },
    ...overrides,
  }
}

function fakeSource(initial: MailMessage[]) {
  const state = {
    inbox: initial,
    listener: () => {},
    fail: false,
  }
  const source: MailSource = {
    async fetchInbox() {
      if (state.fail) throw new Error('imap down')
      return state.inbox
    },
    onChange(listener) {
      state.listener = listener
    },
    async start() {},
    async stop() {},
  }
  return { source, state }
}

function fakeStore() {
  const rows = new Map<string, MailRecord & { id: string }>()
  const log: string[] = []
  let next = 1
  const store: MailStore = {
    async list() {
      return [...rows.values()]
    },
    async create(record) {
      const id = `r${next++}`
      rows.set(id, { ...record, id })
      log.push(`create ${record.uid}`)
    },
    async update(id, changes) {
      rows.set(id, { ...rows.get(id)!, ...changes })
      log.push(`update ${rows.get(id)!.uid} ${Object.keys(changes).join(',')}`)
    },
    async remove(id) {
      log.push(`remove ${rows.get(id)!.uid}`)
      rows.delete(id)
    },
  }
  return { store, rows, log }
}

function setup(initial: MailMessage[]) {
  const { source, state } = fakeSource(initial)
  const { store, rows, log } = fakeStore()
  const sync = createMailSync({
    source,
    store,
    account: 'me@example.test',
    refreshMs: 1_000_000,
    changeDelayMs: 5,
    now: () => new Date('2026-11-05T12:00:00.000Z'),
  })
  return { sync, state, rows, log }
}

describe('mail sync', () => {
  it('stores new mail and reports the status', async () => {
    const { sync, rows } = setup([message(1), message(2)])
    await sync.syncOnce()
    assert.equal(rows.size, 2)
    assert.deepEqual(sync.status(), {
      state: 'connected',
      account: 'me@example.test',
      lastSync: '2026-11-05T12:00:00.000Z',
      count: 2,
      error: null,
    })
  })

  it('changes nothing when nothing changed', async () => {
    const { sync, log } = setup([message(1)])
    await sync.syncOnce()
    log.length = 0
    await sync.syncOnce()
    assert.deepEqual(log, [])
  })

  it('updates only what changed, such as a message being read', async () => {
    const { sync, state, log } = setup([message(1)])
    await sync.syncOnce()
    log.length = 0
    state.inbox = [message(1, { seen: true })]
    await sync.syncOnce()
    assert.deepEqual(log, ['update 1 seen'])
  })

  it('removes mail that left the inbox', async () => {
    const { sync, state, rows } = setup([message(1), message(2)])
    await sync.syncOnce()
    state.inbox = [message(2)]
    await sync.syncOnce()
    assert.deepEqual([...rows.values()].map((r) => r.uid), [2])
  })

  it('treats a new UIDVALIDITY as entirely new mail', async () => {
    const { sync, state, rows, log } = setup([message(1)])
    await sync.syncOnce()
    log.length = 0
    state.inbox = [message(1, { uidValidity: 2 })]
    await sync.syncOnce()
    assert.deepEqual(log.sort(), ['create 1', 'remove 1'])
    assert.equal([...rows.values()][0].uidValidity, 2)
  })

  it('keeps no snippet for sensitive mail', async () => {
    const { sync, rows } = setup([
      message(1, { subject: 'Din engångskod är 4821', body: 'Koden är 4821' }),
    ])
    await sync.syncOnce()
    const [row] = [...rows.values()]
    assert.equal(row.sensitive, true)
    assert.equal(row.snippet, '')
  })

  it('keeps the stored mail and reports an error when the mailbox fails', async () => {
    const { sync, state, rows } = setup([message(1)])
    await sync.syncOnce()
    state.fail = true
    await sync.syncOnce()
    assert.equal(rows.size, 1)
    assert.equal(sync.status().state, 'error')
    assert.equal(sync.status().error, 'imap down')
    assert.equal(sync.status().count, 1)
  })

  it('recovers after an error', async () => {
    const { sync, state } = setup([message(1)])
    state.fail = true
    await sync.syncOnce()
    state.fail = false
    await sync.syncOnce()
    assert.equal(sync.status().state, 'connected')
    assert.equal(sync.status().error, null)
  })

  it('syncs again when the mailbox reports a change', async () => {
    const { sync, state, rows } = setup([message(1)])
    await sync.start()
    assert.equal(rows.size, 1)
    state.inbox = [message(1), message(2)]
    state.listener()
    state.listener() // a burst of notifications is handled once
    await new Promise((resolve) => setTimeout(resolve, 60))
    assert.equal(rows.size, 2)
    await sync.stop()
  })

  it('does not run two syncs at once, but does not lose a change', async () => {
    const { sync, state, rows } = setup([message(1)])
    const first = sync.syncOnce()
    state.inbox = [message(1), message(2)]
    const second = sync.syncOnce()
    await Promise.all([first, second])
    assert.equal(rows.size, 2)
  })

  it('reports an error status if the connection cannot start', async () => {
    const failing = createMailSync({
      source: {
        async fetchInbox() {
          throw new Error('login failed')
        },
        onChange() {},
        async start() {
          throw new Error('login failed')
        },
        async stop() {},
      },
      store: fakeStore().store,
      account: 'me@example.test',
      refreshMs: 1_000_000,
    })
    await failing.start()
    assert.equal(failing.status().state, 'error')
    assert.equal(failing.status().error, 'login failed')
    await failing.stop()
  })
})
