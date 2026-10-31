import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  FullScreenSpinner,
  Icon,
  Sheet,
  CardHeader,
} from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { can } from '@/lib/roles'
import { tagShortLabel } from '@/lib/tags'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useDoors } from '@/features/doors/api'
import { TagScanSheet } from '@/features/scan/TagScanSheet'
import { sameNumber, useCreateKey, useDeleteKey, useKey, useKeys, useUpdateKey } from './api'
import { KeyPhotoCard } from './KeyPhotoCard'
import { KeyForm } from './KeyForm'
import { nextCopyLabel } from './schemas'

export function KeyDetailPage() {
  const { kid = '' } = useParams()
  const { hid, household, online } = useCurrentHousehold()
  const key = useKey(hid, kid)
  const doors = useDoors(hid)
  const allKeys = useKeys(hid)
  const navigate = useNavigate()
  const update = useUpdateKey(hid)
  const createKey = useCreateKey(hid)
  const del = useDeleteKey(hid)
  const [mode, setMode] = useState<null | 'delete' | 'tag'>(null)
  const [saved, setSaved] = useState(false)

  if (key === undefined || doors === undefined || allKeys === undefined)
    return <FullScreenSpinner />
  if (key === null) return <EmptyState title="Key not found">It may have been deleted.</EmptyState>

  const door = doors.find((d) => d.id === key.door_id)
  const copies = sameNumber(allKeys, key.key_number).filter((k) => k.door_id === key.door_id)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={door ? `/h/${hid}/doors/${door.id}` : `/h/${hid}`}
        aria-label="Back"
        className="surface inline-flex size-11 items-center justify-center rounded-2xl! text-slate-700 dark:text-slate-200"
      >
        <Icon name="chevronLeft" />
      </Link>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-300 via-accent-400 to-accent-600 p-5 text-slate-950 shadow-float">
        <div
          className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-white/25"
          aria-hidden="true"
        />
        <p className="relative flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
          <Icon name="key" className="size-4" /> Key{key.label ? ` · ${key.label}` : ''}
        </p>
        <h1 className="relative mt-1 font-mono text-4xl font-extrabold tracking-wider">
          {key.key_number}
        </h1>
        <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-sm font-semibold">
          <Icon name="door" className="size-4" />
          {door ? `Opens ${door.name}` : 'Not assigned to a door'}
        </p>
      </section>

      <KeyPhotoCard keyRow={key} />

      <Card>
        <KeyForm
          key={key.updated_at}
          doors={doors}
          defaults={{
            key_number: key.key_number,
            door_id: key.door_id ?? '',
            label: key.label ?? '',
            holder: key.holder ?? '',
          }}
          submitLabel="Save changes"
          pending={update.isPending}
          error={update.error}
          disabled={!online}
          onSubmit={(v) => {
            setSaved(false)
            update.mutate(
              { id: key.id, ...v },
              {
                onSuccess: () => {
                  setSaved(true)
                },
              },
            )
          }}
          extra={saved && <Banner tone="success">Saved.</Banner>}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader icon="copy" title="Second copy" tone="accent" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Add another key with the same number for this door (labelled “
          {nextCopyLabel(copies.length)}”).
        </p>
        {createKey.isError && <Banner tone="error">{errorMessage(createKey.error)}</Banner>}
        <Button
          variant="secondary"
          disabled={!online}
          loading={createKey.isPending}
          onClick={() => {
            createKey.mutate(
              {
                key_number: key.key_number,
                door_id: key.door_id,
                label: nextCopyLabel(copies.length),
                holder: null,
              },
              {
                onSuccess: (id) => {
                  void navigate(`/h/${hid}/keys/${id}`)
                },
              },
            )
          }}
        >
          Add {nextCopyLabel(copies.length)}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader icon="qr" title="Tag" />
        {key.tag_id ? (
          <p className="text-sm">
            Tagged: <span className="font-mono">{tagShortLabel(key.tag_id)}</span>. Scanning it
            shows this door.
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Stick a printed QR tag (or an NFC tag on Android) on this key’s ring, then scan it here.
          </p>
        )}
        {update.isError && mode === null && (
          <Banner tone="error">{errorMessage(update.error)}</Banner>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!online}
            onClick={() => {
              setMode('tag')
            }}
          >
            {key.tag_id ? 'Replace tag' : 'Assign tag'}
          </Button>
          {key.tag_id && (
            <Button
              variant="ghost"
              disabled={!online}
              loading={update.isPending}
              onClick={() => {
                update.mutate({ id: key.id, tag_id: null })
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {can(household.role, 'delete') && (
        <Button
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          disabled={!online}
          onClick={() => {
            setMode('delete')
          }}
        >
          Delete key
        </Button>
      )}

      <TagScanSheet
        open={mode === 'tag'}
        onClose={() => {
          setMode(null)
        }}
        pending={update.isPending}
        error={update.error}
        onTag={(tagId) => {
          update.mutate(
            { id: key.id, tag_id: tagId },
            {
              onSuccess: () => {
                setMode(null)
              },
            },
          )
        }}
      />

      <Sheet
        open={mode === 'delete'}
        onClose={() => {
          del.reset()
          setMode(null)
        }}
        title="Delete key"
      >
        <div className="flex flex-col gap-4">
          <p>
            Delete key <strong className="font-mono">{key.key_number}</strong>
            {key.label ? ` (${key.label})` : ''}?
          </p>
          {del.isError && <Banner tone="error">{errorMessage(del.error)}</Banner>}
          <Button
            variant="danger"
            size="lg"
            loading={del.isPending}
            onClick={() => {
              del.mutate(key, {
                onSuccess: () => {
                  void navigate(door ? `/h/${hid}/doors/${door.id}` : `/h/${hid}`, {
                    replace: true,
                  })
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
