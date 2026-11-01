import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Banner,
  DoorIcon,
  EmptyState,
  FullScreenSpinner,
  Icon,
  LinkButton,
  SectionTitle,
  Sheet,
} from '@/components/ui'
import { DOOR_TYPE_LABEL } from '@/types/models'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useCreateDoor, useCreateRoomWithWashroom, useDoors, useKeyCounts, groupDoors } from './api'
import { DoorForm, RoomWithWashroomForm } from './DoorForms'

type Adding = null | 'door' | 'room'

export function DoorsPage() {
  const { hid, online } = useCurrentHousehold()
  const doors = useDoors(hid)
  const counts = useKeyCounts(hid)
  const [params] = useSearchParams()
  const [adding, setAdding] = useState<Adding>(null)
  const createDoor = useCreateDoor(hid)
  const createRoom = useCreateRoomWithWashroom(hid)

  if (!doors) return <FullScreenSpinner />
  const sections = groupDoors(doors)
  const unassigned = counts?.get('') ?? 0
  const close = () => {
    createDoor.reset()
    createRoom.reset()
    setAdding(null)
  }

  const keyTotal = [...(counts?.values() ?? [])].reduce((a, b) => a + b, 0)
  const withoutKeys = doors.filter((d) => (counts?.get(d.id) ?? 0) === 0).length

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Overview"
        className="bg-brand-gradient relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-float"
      >
        <div className="relative">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Doors</h1>
          <p className="text-sm text-white/80">
            {doors.length} door{doors.length === 1 ? '' : 's'} · {keyTotal} key
            {keyTotal === 1 ? '' : 's'}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Doors', value: doors.length },
              { label: 'Keys', value: keyTotal },
              { label: 'Need keys', value: withoutKeys },
            ].map((x) => (
              <div
                key={x.label}
                className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur"
              >
                <dt className="text-[11px] font-semibold tracking-wide text-white/75 uppercase">
                  {x.label}
                </dt>
                <dd className="text-2xl font-extrabold">{x.value}</dd>
              </div>
            ))}
          </dl>
          {doors.length > 0 && (
            <LinkButton
              to={`/h/${hid}/doors/quick-keys`}
              variant="secondary"
              aria-disabled={!online}
              className="mt-4 w-full bg-white! text-slate-950! ring-0!"
            >
              <Icon name="bolt" className="size-4" />
              Quick add keys
            </LinkButton>
          )}
        </div>
      </section>

      {params.get('setup') === '1' && doors.length === 0 && (
        <Banner tone="info">
          Your home is ready. Start by adding doors — use <strong>Room + washroom</strong> for rooms
          with an attached washroom. Then add keys with <strong>Quick add keys</strong>.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!online}
          onClick={() => {
            setAdding('room')
          }}
          className="surface flex flex-col items-start gap-3 p-4 text-left transition active:scale-[0.98] disabled:opacity-50"
        >
          <span
            className="flex size-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            aria-hidden="true"
          >
            <Icon name="layers" />
          </span>
          <span>
            <span className="block font-bold">+ Room + washroom</span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">
              Two doors in one step
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={() => {
            setAdding('door')
          }}
          className="surface flex flex-col items-start gap-3 p-4 text-left transition active:scale-[0.98] disabled:opacity-50"
        >
          <span
            className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            aria-hidden="true"
          >
            <Icon name="plus" />
          </span>
          <span>
            <span className="block font-bold">+ Single door</span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">
              Main door, store, balcony…
            </span>
          </span>
        </button>
      </div>

      {doors.length === 0 ? (
        <EmptyState title="No doors yet" icon="door">
          Add the doors of your home to start recording keys.
        </EmptyState>
      ) : (
        sections.map((s) => (
          <section key={s.title} aria-label={s.title} className="flex flex-col gap-2.5">
            <SectionTitle>{s.title}</SectionTitle>
            <ul className="surface divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
              {s.doors.map((d) => {
                const n = counts?.get(d.id) ?? 0
                return (
                  <li key={d.id}>
                    <Link
                      to={`/h/${hid}/doors/${d.id}`}
                      className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className={d.door_type === 'washroom' && d.room_group ? 'pl-5' : ''}>
                        <DoorIcon type={d.door_type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{d.name}</span>
                        <span className="block text-sm text-slate-600 dark:text-slate-400">
                          {DOOR_TYPE_LABEL[d.door_type]}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          n === 0
                            ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                            : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                        }`}
                      >
                        {n === 0 ? 'No keys' : `${n} key${n === 1 ? '' : 's'}`}
                      </span>
                      <Icon name="chevronRight" className="size-4 text-slate-400" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
      {unassigned > 0 && (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {unassigned} key{unassigned === 1 ? ' isn’t' : 's aren’t'} assigned to a door — search for{' '}
          {unassigned === 1 ? 'it' : 'them'} on the Find tab.
        </p>
      )}

      <Sheet open={adding === 'door'} onClose={close} title="Add a door">
        <DoorForm
          key={adding === 'door' ? 'open' : 'closed'}
          submitLabel="Add door"
          pending={createDoor.isPending}
          error={createDoor.error}
          disabled={!online}
          onSubmit={(v) => {
            createDoor.mutate(v, { onSuccess: close })
          }}
        />
      </Sheet>
      <Sheet open={adding === 'room'} onClose={close} title="Add room with washroom">
        <RoomWithWashroomForm
          key={adding === 'room' ? 'open' : 'closed'}
          pending={createRoom.isPending}
          error={createRoom.error}
          disabled={!online}
          onSubmit={(v) => {
            createRoom.mutate(v, { onSuccess: close })
          }}
        />
      </Sheet>
    </div>
  )
}
