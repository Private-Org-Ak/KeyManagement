import { useMemo, useState } from 'react'
import { Banner, Button, Card, FullScreenSpinner, LinkButton, PageHeader } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import type { DoorRow } from '@/types/models'
import { compareDoors, useDoors, useKeyCounts } from '@/features/doors/api'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useCreateKey } from './api'
import { KeyForm } from './KeyForm'
import { nextCopyLabel } from './schemas'

interface LastSaved {
  doorId: string
  doorName: string
  number: string
}

/**
 * Setup loop (PRD "Setup UX"): pick door → number (type/scan) → one-tap second copy → next door.
 * Target: 20 doors / 40 keys in minutes.
 */
export function QuickAddKeysPage() {
  const { hid, online } = useCurrentHousehold()
  const doors = useDoors(hid)
  const counts = useKeyCounts(hid)
  const create = useCreateKey(hid)
  const copy = useCreateKey(hid)
  const [doorId, setDoorId] = useState<string | null>(null)
  const [last, setLast] = useState<LastSaved | null>(null)
  const [formVersion, setFormVersion] = useState(0)

  const ordered = useMemo(() => (doors ? [...doors].sort(compareDoors) : []), [doors])
  if (!doors || !counts) return <FullScreenSpinner />

  const firstEmpty = (after?: string): DoorRow | undefined => {
    const start = after ? ordered.findIndex((d) => d.id === after) + 1 : 0
    return [...ordered.slice(start), ...ordered.slice(0, start)].find(
      (d) => (counts.get(d.id) ?? 0) === 0,
    )
  }
  const currentId = doorId ?? firstEmpty()?.id ?? ordered[0]?.id ?? ''
  const done = ordered.filter((d) => (counts.get(d.id) ?? 0) > 0).length
  const lastCount = last ? (counts.get(last.doorId) ?? 0) : 0

  const goNext = () => {
    const next = firstEmpty(last?.doorId ?? currentId)
    setDoorId(next?.id ?? currentId)
    setLast(null)
    copy.reset()
    setFormVersion((v) => v + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quick add keys"
        back={`/h/${hid}/doors`}
        subtitle={`${done} of ${ordered.length} doors have keys`}
      />
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ordered.length}
        aria-valuenow={done}
        aria-label="Doors with keys"
      >
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${ordered.length ? (done / ordered.length) * 100 : 0}%` }}
        />
      </div>

      {!online && <Banner tone="warning">Adding keys needs a connection.</Banner>}

      {last ? (
        <Card className="flex flex-col gap-3">
          <p role="status">
            Saved <strong className="font-mono">{last.number}</strong> for{' '}
            <strong>{last.doorName}</strong>
            {lastCount > 1 ? ` (${lastCount} keys)` : ''}.
          </p>
          {copy.isError && <Banner tone="error">{errorMessage(copy.error)}</Banner>}
          <Button
            size="lg"
            disabled={!online}
            loading={copy.isPending}
            onClick={() => {
              copy.mutate({
                key_number: last.number,
                door_id: last.doorId,
                label: nextCopyLabel(lastCount),
                holder: null,
              })
            }}
          >
            Same number, {nextCopyLabel(lastCount).toLowerCase()}
          </Button>
          <Button size="lg" variant="secondary" onClick={goNext}>
            Next door →
          </Button>
        </Card>
      ) : (
        <Card>
          <KeyForm
            key={`${currentId}-${formVersion}`}
            doors={ordered}
            defaults={{
              key_number: '',
              door_id: currentId,
              label: nextCopyLabel(counts.get(currentId) ?? 0),
              holder: '',
            }}
            submitLabel="Save key"
            pending={create.isPending}
            error={create.error}
            disabled={!online}
            onSubmit={(v) => {
              create.mutate(v, {
                onSuccess: () => {
                  const d = ordered.find((x) => x.id === v.door_id)
                  if (v.door_id && d) {
                    setDoorId(v.door_id)
                    setLast({ doorId: v.door_id, doorName: d.name, number: v.key_number })
                  } else {
                    setFormVersion((x) => x + 1)
                  }
                },
              })
            }}
          />
        </Card>
      )}

      {done === ordered.length && ordered.length > 0 && (
        <Banner tone="success">
          Every door has at least one key.{' '}
          <LinkButton to={`/h/${hid}`} variant="ghost">
            Try a lookup
          </LinkButton>
        </Banner>
      )}
    </div>
  )
}
