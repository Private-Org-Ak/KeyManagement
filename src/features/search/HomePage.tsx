import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  DoorIcon,
  EmptyState,
  FullScreenSpinner,
  Icon,
  LinkButton,
  SectionTitle,
} from '@/components/ui'
import { getRecentDoors, pushRecentDoor } from '@/lib/local'
import { searchTyped } from '@/lib/match'
import { useDoors } from '@/features/doors/api'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useKeys } from '@/features/keys/api'
import { DoorResultCard } from './DoorResultCard'

export function HomePage() {
  const { hid } = useCurrentHousehold()
  const doors = useDoors(hid)
  const keys = useKeys(hid)
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  const results = useMemo(
    () => (doors && keys ? searchTyped(deferred, keys, doors) : []),
    [deferred, keys, doors],
  )
  const recent = useMemo(() => {
    if (!doors) return []
    const byId = new Map(doors.map((d) => [d.id, d]))
    return getRecentDoors(hid).flatMap((id) => {
      const d = byId.get(id)
      return d ? [d] : []
    })
  }, [doors, hid])

  if (!doors || !keys) return <FullScreenSpinner />

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
        }}
        className="bg-brand-gradient relative overflow-hidden rounded-[2rem] p-5 text-white shadow-float"
      >
        <div
          className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <label
          htmlFor="key-search"
          className="relative block text-[26px] leading-tight font-extrabold tracking-tight"
        >
          Which door is this key for?
        </label>
        <p className="relative mt-1 text-sm text-white/80">
          Type the number stamped on the key — even part of it.
        </p>
        <div className="relative mt-4">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-slate-400"
          />
          <input
            id="key-search"
            type="search"
            inputMode="text"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="e.g. 4417"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            className="block min-h-16 w-full rounded-2xl border-0 bg-white pr-4 pl-13 font-mono text-2xl font-bold text-slate-900 shadow-lg placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:text-slate-400 focus:ring-4 focus:ring-accent-300 focus:outline-none"
          />
        </div>
        <LinkButton
          to={`/h/${hid}/scan`}
          variant="secondary"
          size="lg"
          className="relative mt-3 w-full bg-white/15! text-white! ring-1! ring-white/30! backdrop-blur hover:bg-white/25!"
        >
          <Icon name="scan" />
          Scan a key or tag
        </LinkButton>
      </form>

      <section aria-live="polite" aria-label="Results" className="flex flex-col gap-3">
        {query.trim() !== '' &&
          (results.length === 0 ? (
            <EmptyState title="No matching key" icon="search">
              Check the number, or{' '}
              <Link
                to={`/h/${hid}/doors`}
                className="font-semibold text-brand-700 underline dark:text-brand-300"
              >
                add the key to a door
              </Link>
              .
            </EmptyState>
          ) : (
            <>
              <SectionTitle>
                {results.length} door{results.length === 1 ? '' : 's'} found
              </SectionTitle>
              {results.map((g, i) => (
                <DoorResultCard
                  key={g.door?.id ?? 'none'}
                  hid={hid}
                  group={g}
                  highlight={i === 0 && g.score === 0}
                />
              ))}
            </>
          ))}
      </section>

      {query.trim() === '' && (
        <>
          {keys.length === 0 ? (
            <EmptyState title="No keys yet">
              <LinkButton to={`/h/${hid}/doors`} variant="soft" className="mt-3">
                Set up doors and keys
              </LinkButton>
            </EmptyState>
          ) : recent.length > 0 ? (
            <section aria-labelledby="recent-h" className="flex flex-col gap-2.5">
              <h2
                id="recent-h"
                className="px-1 text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-400"
              >
                Recent
              </h2>
              <ul className="grid grid-cols-2 gap-2.5">
                {recent.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/h/${hid}/doors/${d.id}`}
                      onClick={() => {
                        pushRecentDoor(hid, d.id)
                      }}
                      className="surface flex min-h-16 items-center gap-2.5 p-2.5"
                    >
                      <DoorIcon type={d.door_type} />
                      <span className="line-clamp-2 text-sm font-semibold">{d.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="surface p-4">
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">
                {keys.length}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                keys recorded
              </p>
            </div>
            <div className="surface p-4">
              <p className="text-3xl font-extrabold text-accent-600 dark:text-accent-300">
                {doors.length}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">doors</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
