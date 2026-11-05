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

type NavItem = {
  id: SectionId
  // The address of the section, which is also what a device opens to land on it.
  path: string
  label: string
  icon: LucideIcon
}

export const allSections: NavItem[] = [
  { id: 'today', path: '/idag', label: 'Idag', icon: CalendarDays },
  { id: 'home', path: '/hem', label: 'Hem', icon: Lightbulb },
  { id: 'tasks', path: '/listor', label: 'Listor', icon: ListChecks },
  { id: 'health', path: '/halsa', label: 'Hälsa', icon: HeartPulse },
  { id: 'money', path: '/ekonomi', label: 'Ekonomi', icon: Wallet },
  { id: 'goals', path: '/mal', label: 'Mål', icon: Target },
  { id: 'mail', path: '/mejl', label: 'Mejl', icon: Mail },
  { id: 'photos', path: '/foton', label: 'Foton', icon: Images },
]

export const moreSection: NavItem = {
  id: 'more',
  path: '/mer',
  label: 'Mer',
  icon: Ellipsis,
}

export const bottomBarSections: NavItem[] = [
  ...allSections.slice(0, 4),
  moreSection,
]

export const moreSectionIds: SectionId[] = [
  'more',
  'money',
  'goals',
  'mail',
  'photos',
]

export function sectionIdFromPath(pathname: string): SectionId | undefined {
  return [...allSections, moreSection].find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  )?.id
}
