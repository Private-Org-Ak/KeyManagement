import Dexie, { type EntityTable } from 'dexie'
import type { CachedHousehold, DoorRow, KeyRow } from '@/types/models'

export interface ThumbRecord {
  key_id: string
  household_id: string
  /** keys.updated_at when the thumbnail was made — refreshed when the key changes. */
  version: string
  blob: Blob
}

export interface MetaRecord {
  key: string
  value: string
}

/**
 * Offline household cache (docs/ARCHITECTURE.md#offline-cache-dexie).
 * Every household-scoped row carries household_id and every read filters by it.
 */
export class KeyFinderDB extends Dexie {
  households!: EntityTable<CachedHousehold, 'id'>
  doors!: EntityTable<DoorRow, 'id'>
  keys!: EntityTable<KeyRow, 'id'>
  thumbs!: EntityTable<ThumbRecord, 'key_id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor(name = 'keyfinder') {
    super(name)
    this.version(1).stores({
      households: '&id',
      doors: '&id, household_id',
      keys: '&id, household_id, door_id, [household_id+tag_id]',
      thumbs: '&key_id, household_id',
      meta: '&key',
    })
  }
}

export const db = new KeyFinderDB()

export const metaKeys = {
  lastSynced: (hid: string) => `lastSynced:${hid}`,
  membershipsLoadedFor: 'membershipsLoadedFor',
} as const

/** Removes every trace of one household from the device (rule 9). */
export async function wipeHousehold(hid: string, database: KeyFinderDB = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.households, database.doors, database.keys, database.thumbs, database.meta],
    async () => {
      await database.households.delete(hid)
      await database.doors.where('household_id').equals(hid).delete()
      await database.keys.where('household_id').equals(hid).delete()
      await database.thumbs.where('household_id').equals(hid).delete()
      await database.meta.delete(metaKeys.lastSynced(hid))
    },
  )
}

/** Sign-out: clear everything. */
export async function wipeAll(database: KeyFinderDB = db): Promise<void> {
  await Promise.all(database.tables.map((t) => t.clear()))
}
