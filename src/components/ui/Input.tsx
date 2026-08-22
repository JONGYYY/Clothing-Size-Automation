import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 text-sm text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]',
        className,
      )}
      {...props}
    />
  )
}
