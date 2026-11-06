import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { isTime, parseTime } from '@/lib/schedule'
import { cn } from '@/lib/utils'

// A time field that is always 24-hour, whatever the device's clock setting.
// The browser's own time input follows the system and can show AM/PM, so
// this is a plain text field that takes "14:00", "1400", or "9".
export function TimeField({
  value,
  onChange,
  className,
  ...props
}: {
  // "14:00", or empty.
  value: string
  // Called with a valid "HH:MM" as soon as one is typed, or with what was
  // typed if it isn't a time, so the form can flag it.
  onChange: (value: string) => void
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(value)
  // Follow changes made from outside, such as the end moving with the start.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value)
  }

  const invalid = text.trim() !== '' && parseTime(text) === null

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="tt:mm"
      maxLength={5}
      value={text}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d:.,]/g, '')
        setText(next)
        // Only a complete time counts while typing ("14:00" or "1400"), so
        // "1" isn't read as 01:00 before the second digit arrives.
        const full =
          /^\d{2}:\d{2}$/.test(next) && isTime(next)
            ? next
            : /^\d{4}$/.test(next)
              ? parseTime(next)
              : null
        const emitted = full ?? next
        setShown(emitted)
        onChange(emitted)
      }}
      onBlur={(event) => {
        const time = parseTime(text)
        if (time && time !== text) {
          setText(time)
          setShown(time)
          onChange(time)
        }
        props.onBlur?.(event)
      }}
      className={cn('tabular-nums', className)}
    />
  )
}
