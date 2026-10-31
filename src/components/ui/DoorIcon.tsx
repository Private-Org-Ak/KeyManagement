import type { DoorType } from '@/types/models'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

const STYLE: Record<DoorType, { icon: IconName; cls: string }> = {
  main: {
    icon: 'home',
    cls: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
  },
  room: {
    icon: 'door',
    cls: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  },
  washroom: { icon: 'bath', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  balcony: {
    icon: 'sun',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  store: {
    icon: 'box',
    cls: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  other: { icon: 'grid', cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
}

/** Colour-coded tile per door type (decorative). */
export function DoorIcon({ type, size = 'md' }: { type: DoorType; size?: 'md' | 'lg' }) {
  const s = STYLE[type]
  return (
    <div
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center',
        size === 'lg' ? 'size-16 rounded-3xl' : 'size-12 rounded-2xl',
        s.cls,
      )}
    >
      <Icon name={s.icon} className={size === 'lg' ? 'size-8' : 'size-6'} />
    </div>
  )
}
