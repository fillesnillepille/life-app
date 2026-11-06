// Monthly money figures and the helpers the Ekonomi pages share.

export type FinanceMonth = {
  id: string
  // "2026-11"
  month: string
  expenses: number
  savings: number
  investments: number
  // Put into investments during the month, minus withdrawals. 0 if not given.
  deposited: number
  note: string
}

export type FinanceValues = Omit<FinanceMonth, 'id' | 'month'>

// From this day of the month the reminder asks for the current month. Before
// it, the previous month is the one to fill in.
export const reminderStartDay = 25

export function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

export function isMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function monthDate(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

export function previousMonthKey(key: string) {
  const date = monthDate(key)
  date.setMonth(date.getMonth() - 1)
  return monthKey(date)
}

// The month that should be filled in now: this month from the 25th, otherwise
// last month.
export function dueMonthKey(now: Date) {
  const key = monthKey(now)
  return now.getDate() >= reminderStartDay ? key : previousMonthKey(key)
}

const monthNameFormat = new Intl.DateTimeFormat('sv-SE', {
  month: 'long',
  year: 'numeric',
})
const shortMonthFormat = new Intl.DateTimeFormat('sv-SE', { month: 'short' })
const shortMonthYearFormat = new Intl.DateTimeFormat('sv-SE', {
  month: 'short',
  year: '2-digit',
})

// "november 2026"
export function formatMonth(key: string) {
  return monthNameFormat.format(monthDate(key))
}

// "nov." for chart axes, with the year added in January so the axis shows
// where a year starts.
export function formatShortMonth(key: string) {
  const date = monthDate(key)
  return date.getMonth() === 0
    ? shortMonthYearFormat.format(date)
    : shortMonthFormat.format(date)
}

const kronorFormat = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})
const compactFormat = new Intl.NumberFormat('sv-SE', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const percentFormat = new Intl.NumberFormat('sv-SE', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})
const signedKronorFormat = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

export const formatKronor = (value: number) => kronorFormat.format(value)
export const formatSignedKronor = (value: number) =>
  signedKronorFormat.format(value)
export const formatCompact = (value: number) => compactFormat.format(value)
export const formatPercent = (value: number) => percentFormat.format(value)

// sv-SE writes negative numbers with U+2212 rather than a hyphen.
const unicodeMinus = new RegExp(String.fromCharCode(0x2212), 'g')

// Reads what was typed in a number field: spaces as thousand separators and a
// decimal comma are fine, and so is the Unicode minus that sv-SE formatting
// uses. Returns null for anything that isn't a number.
export function parseAmount(text: string) {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(unicodeMinus, '-')
    .replace(',', '.')
  if (cleaned === '' || cleaned === '-') return null
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Math.round(Number(cleaned))
}

// Shows a stored amount in a field, with plain spaces between thousands and a
// plain minus, so it reads back through parseAmount.
export function amountText(value: number) {
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
    .format(value)
    .replace(/\s/g, ' ')
    .replace(unicodeMinus, '-')
}

// The month to fill in, or null when it's already saved.
export function missingMonth(months: FinanceMonth[], now: number) {
  const due = dueMonthKey(new Date(now))
  return months.some((item) => item.month === due) ? null : due
}

export const totalOf = (month: Pick<FinanceMonth, 'savings' | 'investments'>) =>
  month.savings + month.investments
