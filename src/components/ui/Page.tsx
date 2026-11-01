import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from './cx'
import { Icon } from './Icon'

export function PageHeader({
  title,
  back,
  actions,
  subtitle,
  eyebrow,
}: {
  title: string
  back?: string
  actions?: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="surface mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-2xl! text-slate-700 dark:text-slate-200"
        >
          <Icon name="chevronLeft" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-bold tracking-wider text-brand-600 uppercase dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-[30px] leading-[1.05] font-extrabold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="mt-1 flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-400">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  icon = 'key',
}: {
  title: string
  children?: ReactNode
  icon?: Parameters<typeof Icon>[0]['name']
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon name={icon} className="size-8" />
      </div>
      <p className="text-lg font-bold">{title}</p>
      {children && (
        <div className="mt-1.5 max-w-xs text-sm text-slate-600 dark:text-slate-400">{children}</div>
      )}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('surface p-5', className)}>{children}</div>
}

/** Card section with an icon tile + title. */
export function CardHeader({
  icon,
  title,
  tone = 'brand',
  children,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  tone?: 'brand' | 'accent' | 'red' | 'emerald'
  children?: ReactNode
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    accent: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }
  return (
    <div className="flex items-start gap-3">
      <div
        className={cx('flex size-11 shrink-0 items-center justify-center rounded-2xl', tones[tone])}
      >
        <Icon name={icon} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-base font-bold">{title}</h2>
        {children && (
          <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{children}</div>
        )}
      </div>
    </div>
  )
}
