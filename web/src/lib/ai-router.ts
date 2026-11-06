// Handles plain Swedish commands without an AI. "Lägg till bädda sängen" needs
// no model, so it never leaves the app. Anything that doesn't clearly match
// returns null and goes to the AI instead.

import type { TodoListId } from '@/lib/use-todos'

export type Command =
  | { kind: 'add'; list: TodoListId; title: string }
  | { kind: 'check'; query: string }
  | { kind: 'remove'; query: string }

const listNames: { list: TodoListId; pattern: RegExp }[] = [
  {
    list: 'shopping',
    pattern: /^(inköpslistan|inköpslista|inköp|handlingslistan|shoppinglistan)$/,
  },
  { list: 'bucket', pattern: /^(bucket ?list(an)?|bucket)$/ },
  {
    list: 'longterm',
    pattern: /^(långsiktiga( listan)?|långsiktig(a)?|långsiktigt)$/,
  },
  {
    list: 'daily',
    pattern:
      /^(att göra( ?-?listan)?|att-göra-listan|dagliga( listan)?|dagligt|listan|todo|to-do)$/,
  },
]

// Words that mean the request is about time or has several parts. Those go to
// the AI, which can use the schedule, rather than being saved as a title.
const needsAi =
  /\b(imorgon|idag|ikväll|igår|måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|vecka|kl|klockan|påminn|och sedan|samt)\b|\d{1,2}[:.]\d{2}/

function clean(text: string) {
  return text
    .trim()
    .replace(/[.!]+$/, '')
    .replace(/\s+/g, ' ')
}

function capitalise(title: string) {
  return title.charAt(0).toLocaleUpperCase('sv-SE') + title.slice(1)
}

// "bädda sängen i att göra-listan" -> the title and the list it names.
function splitList(rest: string): { title: string; list: TodoListId } {
  const match = rest.match(
    /^(.+?)\s+(?:i|på|till)\s+(?:min\s+|mina\s+|mitt\s+|vår\s+)?([\p{L}\- ]+)$/u,
  )
  if (match) {
    const name = match[2].trim().toLowerCase()
    const found = listNames.find((entry) => entry.pattern.test(name))
    if (found) return { title: match[1], list: found.list }
  }
  return { title: rest, list: 'daily' }
}

export function parseCommand(input: string): Command | null {
  const text = clean(input)
  const lower = text.toLowerCase()
  if (!text || lower.endsWith('?') || text.length > 120) return null

  const add = lower.match(/^(?:lägg till|lägg in|addera|skriv upp)\s+(.+)$/)
  if (add && !needsAi.test(add[1])) {
    const { title, list } = splitList(add[1])
    return title ? { kind: 'add', list, title: capitalise(title) } : null
  }

  const buy = lower.match(/^(?:köp|handla)\s+(.+)$/)
  if (buy && !needsAi.test(buy[1])) {
    return { kind: 'add', list: 'shopping', title: capitalise(buy[1]) }
  }

  const check = lower.match(
    /^(?:bocka av|klarmarkera|markera)\s+(.+?)(?:\s+som (?:klar|klart|gjord|gjort))?$/,
  )
  if (check) return { kind: 'check', query: check[1] }

  const remove = lower.match(/^(?:ta bort|radera|stryk)\s+(.+?)(?:\s+från .+)?$/)
  if (remove) return { kind: 'remove', query: remove[1] }

  return null
}

// The open items a short phrase could mean: an exact title first, else titles
// that contain the phrase.
export function findByTitle<T extends { title: string; done: boolean }>(
  items: T[],
  query: string,
) {
  const wanted = query.toLowerCase()
  const open = items.filter((item) => !item.done)
  const exact = open.filter((item) => item.title.toLowerCase() === wanted)
  if (exact.length > 0) return exact
  return open.filter((item) => item.title.toLowerCase().includes(wanted))
}
