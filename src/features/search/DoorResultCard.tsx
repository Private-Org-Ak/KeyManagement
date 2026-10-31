import { Link } from 'react-router'
import { DoorIcon, Icon, cx } from '@/components/ui'
import { pushRecentDoor } from '@/lib/local'
import type { DoorGroup } from '@/lib/match'
import { DOOR_TYPE_LABEL, type DoorRow, type KeyRow } from '@/types/models'
import { KeyThumb } from '@/features/keys/KeyThumb'

/** One result: a door (or "Not assigned") with the matching keys and their holders. */
export function DoorResultCard({
  hid,
  group,
  highlight = false,
}: {
  hid: string
  group: DoorGroup<KeyRow, DoorRow>
  highlight?: boolean
}) {
  const { door, keys } = group
  const meta = door
    ? [DOOR_TYPE_LABEL[door.door_type], door.floor && `Floor ${door.floor}`]
        .filter(Boolean)
        .join(' · ')
    : ''
  return (
    <article
      aria-label={door ? `Door: ${door.name}` : 'Keys not assigned to a door'}
      className={cx(
        'surface overflow-hidden',
        highlight && 'ring-2! ring-emerald-400 dark:ring-emerald-400/70',
      )}
    >
      {highlight && (
        <p className="flex items-center gap-1.5 bg-emerald-50 px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-800 uppercase dark:bg-emerald-500/15 dark:text-emerald-200">
          <Icon name="check" className="size-3.5" /> Exact match
        </p>
      )}
      {door ? (
        <Link
          to={`/h/${hid}/doors/${door.id}`}
          onClick={() => {
            pushRecentDoor(hid, door.id)
          }}
          className="flex min-h-16 items-center gap-3 px-4 pt-4 pb-3"
        >
          <DoorIcon type={door.door_type} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-extrabold tracking-tight">
              {door.name}
            </span>
            {meta && <span className="text-sm text-slate-600 dark:text-slate-400">{meta}</span>}
          </span>
          <Icon name="chevronRight" className="text-slate-400" />
        </Link>
      ) : (
        <p className="px-4 pt-4 pb-3 text-lg font-bold text-slate-600 dark:text-slate-400">
          Not assigned to a door
        </p>
      )}
      <ul className="mx-3 mb-3 flex flex-col gap-1 rounded-2xl bg-slate-50 p-1 dark:bg-white/5">
        {keys.map((k) => (
          <li key={k.id}>
            <Link
              to={`/h/${hid}/keys/${k.id}`}
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white dark:hover:bg-white/5"
            >
              <KeyThumb keyId={k.id} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono font-bold tracking-wide">{k.key_number}</span>
                <span className="block truncate text-sm text-slate-600 dark:text-slate-400">
                  {[k.label, k.holder && `With ${k.holder}`].filter(Boolean).join(' · ') || 'Key'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}
