import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type Tone = 'info' | 'warning' | 'error' | 'success'
const tones: Record<Tone, { cls: string; icon: IconName }> = {
  info: {
    cls: 'bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-400/20',
    icon: 'bolt',
  },
  warning: {
    cls: 'bg-accent-100 text-accent-700 ring-accent-200 dark:bg-accent-500/10 dark:text-accent-200 dark:ring-accent-400/20',
    icon: 'wifiOff',
  },
  error: {
    cls: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/20',
    icon: 'x',
  },
  success: {
    cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20',
    icon: 'check',
  },
}

export function Banner({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1',
        tones[tone].cls,
        className,
      )}
    >
      <Icon name={tones[tone].icon} className="mt-0.5 size-4" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
