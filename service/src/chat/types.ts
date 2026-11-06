export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

// Things the AI suggests. The service never carries these out: the app shows
// them as buttons and the user decides, per the approval rule.
export type ChatAction =
  | {
      type: 'add_todo'
      list: 'daily' | 'longterm' | 'bucket' | 'shopping'
      title: string
    }
  | {
      type: 'add_schedule_entry'
      title: string
      date: string
      allDay: boolean
      start: string
      end: string
    }

export type ChatReply = {
  text: string
  actions: ChatAction[]
}

export type ChatStatus = {
  state: 'ready' | 'not_configured'
  // The day the API key runs out as "2026-12-06", or null if not given.
  keyExpires: string | null
}

export type ChatService = {
  status(): ChatStatus
  // `token` is the signed-in user's own PocketBase token, so the database's
  // owner-only rules decide what the AI can read.
  reply(token: string, messages: ChatMessage[]): Promise<ChatReply>
}

export class ChatNotConfiguredError extends Error {
  constructor() {
    super('ai_not_configured')
  }
}

export class ChatLimitError extends Error {
  constructor() {
    super('ai_limit')
  }
}

// Anthropic refused the key: it ran out, was deleted, or has no credit.
export class ChatKeyInvalidError extends Error {
  constructor() {
    super('ai_key_invalid')
  }
}

export class ChatUnavailableError extends Error {
  constructor() {
    super('ai_unavailable')
  }
}
