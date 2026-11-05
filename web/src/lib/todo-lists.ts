import type { TodoListId } from '@/lib/use-todos'

export type ListConfig = {
  id: TodoListId
  tab: string
  title: string
  placeholder: string
  empty: string
  // Wording for finished items. Defaults suit tasks.
  doneHeading?: string
  doneLabel?: string
}

export const lists: ListConfig[] = [
  {
    id: 'daily',
    tab: 'Dagligt',
    title: 'Dagliga uppgifter',
    placeholder: 'Vad ska göras idag?',
    empty: 'Inget att göra idag.',
  },
  {
    id: 'longterm',
    tab: 'Långsiktigt',
    title: 'Långsiktigt',
    placeholder: 'Ny uppgift',
    empty: 'Inga långsiktiga uppgifter.',
  },
  {
    id: 'bucket',
    tab: 'Bucket list',
    title: 'Bucket list',
    placeholder: 'Något du vill uppleva',
    empty: 'Bucket listan är tom.',
  },
  {
    id: 'shopping',
    tab: 'Inköp',
    title: 'Inköp',
    placeholder: 'Vad ska handlas?',
    empty: 'Inköpslistan är tom.',
    doneHeading: 'Köpta',
    doneLabel: 'Köpt',
  },
]
