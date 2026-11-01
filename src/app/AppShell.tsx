import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router'
import { Icon, Sheet, cx, type IconName } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useHousehold, useHouseholds } from '@/features/households/api'
import { ROLE_LABEL } from '@/lib/roles'
import { UpdateToast } from './UpdateToast'

function initial(text: string | null | undefined): string {
  return (text?.trim()[0] ?? 'K').toUpperCase()
}

/** Top app bar (+ home switcher) and, inside a household, a floating bottom tab bar. */
export function AppShell() {
  const match = useMatch('/h/:hid/*')
  const hid = match?.params.hid ?? null
  const { session, account } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-white px-4 py-3 font-medium text-slate-900 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {session && (
        <header className="pt-safe px-safe animate-header-in sticky top-0 z-30 bg-canvas/75 backdrop-blur-xl backdrop-saturate-150 dark:bg-canvas-dark/75">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-2">
            {hid ? (
              <HouseholdSwitcher hid={hid} />
            ) : (
              <Link
                to="/"
                className="flex min-h-11 items-center gap-2.5 text-lg font-extrabold tracking-tight"
              >
                <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
                KeyFinder
              </Link>
            )}
            <Link
              to="/account"
              aria-label="Account"
              className="ml-auto inline-flex size-11 items-center justify-center glass rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              {account?.startsWith('+') ? (
                <Icon name="user" className="size-5" />
              ) : (
                initial(account)
              )}
            </Link>
          </div>
        </header>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={cx(
          'px-safe mx-auto w-full max-w-2xl flex-1 pt-2 outline-none',
          hid ? 'pb-32' : 'pb-safe pb-8',
        )}
      >
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      {hid && <BottomNav hid={hid} />}
      <UpdateToast />
    </div>
  )
}

function HouseholdSwitcher({ hid }: { hid: string }) {
  const current = useHousehold(hid)
  const all = useHouseholds()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="-ml-1 flex min-h-11 min-w-0 items-center gap-2.5 rounded-2xl py-1 pr-3 pl-1 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/5"
        aria-haspopup="dialog"
      >
        <span
          className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-float"
          aria-hidden="true"
        >
          {initial(current?.name)}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
            Home
          </span>
          <span className="flex items-center gap-1">
            <span className="truncate text-base leading-tight font-bold">
              {current?.name ?? 'KeyFinder'}
            </span>
            <span className="sr-only">, switch home</span>
            <Icon name="chevronDown" className="size-4 text-slate-600 dark:text-slate-400" />
          </span>
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        title="Your homes"
      >
        <ul className="flex flex-col gap-2">
          {all?.map((h) => (
            <li key={h.id}>
              <Link
                to={`/h/${h.id}/doors`}
                onClick={() => {
                  setOpen(false)
                }}
                aria-current={h.id === hid ? 'true' : undefined}
                className={cx(
                  'flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 ring-1 transition',
                  h.id === hid
                    ? 'bg-brand-50 ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-400/30'
                    : 'ring-slate-200 hover:bg-slate-50 dark:ring-white/10 dark:hover:bg-white/5',
                )}
              >
                <span
                  className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl font-bold text-white"
                  aria-hidden="true"
                >
                  {initial(h.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{h.name}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {ROLE_LABEL[h.role]}
                  </span>
                </span>
                {h.id === hid && (
                  <Icon name="check" className="text-brand-600 dark:text-brand-300" />
                )}
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/onboarding"
              onClick={() => {
                setOpen(false)
              }}
              className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 px-3 font-semibold text-brand-700 hover:bg-slate-50 dark:border-white/15 dark:text-brand-300 dark:hover:bg-white/5"
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15"
                aria-hidden="true"
              >
                <Icon name="plus" />
              </span>
              Create or join a home
            </Link>
          </li>
        </ul>
      </Sheet>
    </>
  )
}

const NAV: {
  to: string
  label: 'Find' | 'Scan' | 'Doors' | 'Members' | 'Settings'
  icon: IconName
  end: boolean
}[] = [
  { to: 'doors', label: 'Doors', icon: 'door', end: false },
  { to: '', label: 'Find', icon: 'search', end: true },
  { to: 'scan', label: 'Scan', icon: 'scan', end: false },
  { to: 'members', label: 'Members', icon: 'users', end: false },
  { to: 'settings', label: 'Settings', icon: 'settings', end: false },
]

function BottomNav({ hid }: { hid: string }) {
  return (
    <nav aria-label="Main" className="pb-safe px-safe animate-nav-in fixed inset-x-0 bottom-0 z-30">
      <ul className="mx-auto mb-3 glass grid max-w-md grid-cols-5 items-end rounded-[1.375rem] px-1 py-1.5">
        {NAV.map((item) => {
          const to = `/h/${hid}${item.to ? `/${item.to}` : ''}`
          if (item.label === 'Scan') {
            return (
              <li key={item.label} className="flex justify-center">
                <NavLink
                  to={to}
                  className="group flex flex-col items-center gap-0.5 text-[11px] font-semibold"
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cx(
                          'bg-brand-gradient -mt-7 flex size-14 items-center justify-center rounded-2xl text-white shadow-float ring-4 ring-canvas transition duration-300 ease-soft group-hover:-translate-y-0.5 group-active:scale-95 dark:ring-canvas-dark',
                          isActive && 'brightness-110',
                        )}
                      >
                        <Icon name="scan" className="size-7" />
                      </span>
                      <span
                        className={
                          isActive
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        Scan
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          }
          return (
            <li key={item.label}>
              <NavLink
                to={to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition',
                    isActive
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'flex h-8 w-12 items-center justify-center rounded-full transition',
                        isActive && 'animate-pop bg-black/[0.06] dark:bg-white/10',
                      )}
                    >
                      <Icon name={item.icon} className="size-[22px]" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
