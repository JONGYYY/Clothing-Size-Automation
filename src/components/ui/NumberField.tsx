import { useEffect, useState } from 'react'
import { Input } from './Input'

interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  min?: number
  placeholder?: string
  suffix?: string
  className?: string
}

/** Number input that keeps a text buffer so partial edits (e.g. "50.") work. */
export function NumberField({
  value,
  onChange,
  min = 0,
  placeholder,
  suffix,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : '')

  useEffect(() => {
    const parsed = parseFloat(text)
    if (!Number.isFinite(value)) {
      if (text !== '') setText('')
    } else if (parsed !== value) {
      setText(String(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
            setText(raw)
            const n = parseFloat(raw)
            if (Number.isFinite(n) && n >= min) onChange(n)
            else if (raw === '') onChange(NaN)
          }
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">
          {suffix}
        </span>
      )}
    </div>
  )
}
