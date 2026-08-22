import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[#0b0d10] hover:brightness-110 shadow-sm font-medium',
  secondary:
    'bg-[var(--color-panel-2)] text-[var(--color-text)] hover:bg-[#232833] border border-[var(--color-border)]',
  outline:
    'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-panel-2)] border border-[var(--color-border)]',
  ghost: 'bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]',
  danger: 'bg-transparent text-[var(--color-danger)] hover:bg-[#2a1a20] border border-[#3a2530]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-8 w-8 p-0 justify-center',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[calc(var(--radius)-2px)] transition-colors disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
