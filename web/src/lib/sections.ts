import {
  CalendarDays,
  Ellipsis,
  HeartPulse,
  Images,
  Lightbulb,
  ListChecks,
  Mail,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type SectionId =
  | 'today'
  | 'home'
  | 'tasks'
  | 'health'
  | 'money'
  | 'goals'
  | 'mail'
  | 'photos'
  | 'more'

type NavItem = { id: SectionId; label: string; icon: LucideIcon }

export const allSections: NavItem[] = [
  { id: 'today', label: 'Idag', icon: CalendarDays },
  { id: 'home', label: 'Hem', icon: Lightbulb },
  { id: 'tasks', label: 'Uppgifter', icon: ListChecks },
  { id: 'health', label: 'Hälsa', icon: HeartPulse },
  { id: 'money', label: 'Ekonomi', icon: Wallet },
  { id: 'goals', label: 'Mål', icon: Target },
  { id: 'mail', label: 'Mejl', icon: Mail },
  { id: 'photos', label: 'Foton', icon: Images },
]

export const bottomBarSections: NavItem[] = [
  ...allSections.slice(0, 4),
  { id: 'more', label: 'Mer', icon: Ellipsis },
]

export const moreSectionIds: SectionId[] = [
  'more',
  'money',
  'goals',
  'mail',
  'photos',
]
