import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-panel)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  )
}
