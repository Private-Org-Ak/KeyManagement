import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Banner,
  Button,
  DoorIcon,
  EmptyState,
  FullScreenSpinner,
  Icon,
  Sheet,
} from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { pushRecentDoor } from '@/lib/local'
import { can } from '@/lib/roles'
import { DOOR_TYPE_LABEL } from '@/types/models'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useCreateKey, useKeysForDoor } from '@/features/keys/api'
import { KeyForm } from '@/features/keys/KeyForm'
import { KeyThumb } from '@/features/keys/KeyThumb'
import { nextCopyLabel } from '@/features/keys/schemas'
import { useDeleteDoor, useDoor, useDoors, useUpdateDoor } from './api'
import { DoorForm } from './DoorForms'

export function DoorDetailPage() {
  const { did = '' } = useParams()
  const { hid, household, online } = useCurrentHousehold()
  const door = useDoor(hid, did)
  const doors = useDoors(hid)
  const keys = useKeysForDoor(hid, did)
  const navigate = useNavigate()
  const [mode, setMode] = useState<null | 'edit' | 'add-key' | 'delete'>(null)
  const update = useUpdateDoor(hid, did)
  const del = useDeleteDoor(hid)
  const createKey = useCreateKey(hid)

  useEffect(() => {
    if (door) pushRecentDoor(hid, door.id)
  }, [hid, door])

  if (door === undefined || keys === undefined || doors === undefined) return <FullScreenSpinner />
  if (door === null)
    return <EmptyState title="Door not found">It may have been deleted.</EmptyState>

  const close = () => {
    update.reset()
    createKey.reset()
    del.reset()
    setMode(null)
  }
  const sharedNumber = keys[0]?.key_number ?? ''

  const meta = [
    door.floor && `Floor ${door.floor}`,
    door.room_group && door.room_group !== door.name && door.room_group,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to={`/h/${hid}/doors`}
          aria-label="Back"
          className="surface inline-flex size-11 items-center justify-center rounded-2xl! text-slate-700 dark:text-slate-200"
        >
          <Icon name="chevronLeft" />
        </Link>
        <Button
          variant="secondary"
          size="sm"
          disabled={!online}
          onClick={() => {
            setMode('edit')
          }}
        >
          <Icon name="edit" className="size-4" />
          Edit
        </Button>
      </div>

      <section className="surface flex flex-col items-center gap-3 px-5 pt-6 pb-5 text-center">
        <DoorIcon type={door.door_type} size="lg" />
        <div>
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">{door.name}</h1>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {DOOR_TYPE_LABEL[door.door_type]}
            </span>
            {meta.map((m) => (
              <span
                key={String(m)}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
        {door.notes && <p className="text-sm text-slate-600 dark:text-slate-400">{door.notes}</p>}
      </section>

      <section aria-labelledby="keys-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="keys-h" className="text-lg font-bold">
            Keys <span className="text-slate-600 dark:text-slate-400">({keys.length})</span>
          </h2>
          <Button
            variant="soft"
            size="sm"
            disabled={!online}
            onClick={() => {
              setMode('add-key')
            }}
          >
            + Add key
          </Button>
        </div>
        {keys.length === 0 ? (
          <EmptyState title="No keys for this door yet">
            Tap “Add key” to record the number stamped on it.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {keys.map((k) => (
              <li key={k.id}>
                <Link
                  to={`/h/${hid}/keys/${k.id}`}
                  className="surface flex min-h-[4.5rem] items-center gap-3 p-3 transition hover:ring-brand-300 dark:hover:ring-brand-400/40"
                >
                  <KeyThumb keyId={k.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-lg font-bold tracking-wide">
                      {k.key_number}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {k.label && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                          {k.label}
                        </span>
                      )}
                      <span
                        className={
                          k.holder
                            ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        {k.holder ? `With ${k.holder}` : 'Holder not set'}
                      </span>
                      {k.tag_id && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                          Tagged
                        </span>
                      )}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="size-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can(household.role, 'delete') && (
        <Button
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          disabled={!online}
          onClick={() => {
            setMode('delete')
          }}
        >
          <Icon name="trash" className="size-4" />
          Delete door
        </Button>
      )}

      <Sheet open={mode === 'edit'} onClose={close} title="Edit door">
        <DoorForm
          key={`${door.id}-${door.updated_at}-${mode ?? ''}`}
          initial={door}
          submitLabel="Save"
          pending={update.isPending}
          error={update.error}
          disabled={!online}
          onSubmit={(v) => {
            update.mutate(v, { onSuccess: close })
          }}
        />
      </Sheet>
      <Sheet open={mode === 'add-key'} onClose={close} title={`Add key — ${door.name}`}>
        <KeyForm
          key={`${keys.length}-${mode ?? ''}`}
          doors={doors}
          defaults={{
            key_number: sharedNumber,
            door_id: door.id,
            label: nextCopyLabel(keys.length),
            holder: '',
          }}
          submitLabel="Add key"
          pending={createKey.isPending}
          error={createKey.error}
          disabled={!online}
          onSubmit={(v) => {
            createKey.mutate(v, { onSuccess: close })
          }}
        />
      </Sheet>
      <Sheet open={mode === 'delete'} onClose={close} title="Delete door">
        <div className="flex flex-col gap-4">
          <p>
            Delete <strong>{door.name}</strong>?{' '}
            {keys.length > 0 &&
              `Its ${keys.length} key${keys.length === 1 ? '' : 's'} will be kept but no longer assigned to a door.`}
          </p>
          {del.isError && <Banner tone="error">{errorMessage(del.error)}</Banner>}
          <Button
            variant="danger"
            size="lg"
            loading={del.isPending}
            onClick={() => {
              del.mutate(door.id, {
                onSuccess: () => {
                  void navigate(`/h/${hid}/doors`, { replace: true })
                },
              })
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
