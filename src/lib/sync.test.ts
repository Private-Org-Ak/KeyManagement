import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorRow, KeyRow } from '@/types/models'

// ---- Supabase mock: tables keyed by name, filtered by .eq() ----
const tables = new Map<string, Record<string, unknown>[]>()
function query(table: string) {
  const filters: [string, unknown][] = []
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters.push([col, val])
      return builder
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
      const rows = (tables.get(table) ?? []).filter((r) => filters.every(([c, v]) => r[c] === v))
      resolve({ data: rows, error: null })
    },
  }
  return builder
}
vi.mock('./supabase', () => ({
  supabase: {
    from: (t: string) => query(t),
    storage: {
      from: () => ({ createSignedUrls: () => Promise.resolve({ data: [], error: null }) }),
    },
  },
}))

const { KeyFinderDB, wipeAll, wipeHousehold } = await import('./db')
const { refreshMemberships, syncHousehold } = await import('./sync')
const { pushRecentDoor, getRecentDoors, setLastHousehold, getLastHousehold } =
  await import('./local')

const door = (id: string, hh: string): DoorRow => ({
  id,
  household_id: hh,
  name: id,
  room_group: null,
  floor: null,
  door_type: 'room',
  notes: null,
  created_at: '',
  updated_at: '',
})
const key = (id: string, hh: string, doorId: string): KeyRow => ({
  id,
  household_id: hh,
  door_id: doorId,
  key_number: id,
  key_number_normalized: id.toUpperCase(),
  label: null,
  holder: null,
  photo_path: null,
  tag_id: null,
  created_at: '',
  updated_at: '',
})

let n = 0
let db: InstanceType<typeof KeyFinderDB>

describe('offline cache', () => {
  beforeEach(async () => {
    db = new KeyFinderDB(`test-${n++}`)
    await db.open()
    localStorage.clear()
    tables.clear()
  })

  it('syncHousehold replaces only that household’s rows', async () => {
    await db.doors.bulkAdd([door('old', 'A'), door('b1', 'B')])
    tables.set('doors', [door('d1', 'A'), door('d2', 'A'), door('b-server', 'B')])
    tables.set('keys', [key('k1', 'A', 'd1')])
    await syncHousehold('A', db)
    expect((await db.doors.where('household_id').equals('A').primaryKeys()).sort()).toEqual([
      'd1',
      'd2',
    ])
    expect(await db.doors.where('household_id').equals('B').primaryKeys()).toEqual(['b1'])
    expect(await db.keys.count()).toBe(1)
    expect(await db.meta.get('lastSynced:A')).toBeDefined()
  })

  it('refreshMemberships wipes households the user lost access to (rule 9)', async () => {
    await db.households.bulkPut([
      { id: 'A', name: 'A', role: 'owner' },
      { id: 'B', name: 'B', role: 'member' },
    ])
    await db.doors.bulkAdd([door('a', 'A'), door('b', 'B')])
    await db.keys.bulkAdd([key('ka', 'A', 'a'), key('kb', 'B', 'b')])
    await db.thumbs.put({ key_id: 'kb', household_id: 'B', version: '', blob: new Blob(['x']) })
    pushRecentDoor('B', 'b')
    setLastHousehold('B')

    tables.set('memberships', [
      { user_id: 'u', household_id: 'A', role: 'owner', households: { id: 'A', name: 'Home A' } },
    ])
    const list = await refreshMemberships('u', db)

    expect(list).toEqual([{ id: 'A', name: 'Home A', role: 'owner' }])
    expect(await db.households.toCollection().primaryKeys()).toEqual(['A'])
    expect(await db.doors.toCollection().primaryKeys()).toEqual(['a'])
    expect(await db.keys.toCollection().primaryKeys()).toEqual(['ka'])
    expect(await db.thumbs.count()).toBe(0)
    expect(getRecentDoors('B')).toEqual([])
    expect(getLastHousehold()).toBeNull()
  })

  it('wipeHousehold and wipeAll clear data', async () => {
    await db.households.bulkPut([
      { id: 'A', name: 'A', role: 'owner' },
      { id: 'B', name: 'B', role: 'owner' },
    ])
    await db.doors.bulkAdd([door('a', 'A'), door('b', 'B')])
    await wipeHousehold('A', db)
    expect(await db.doors.toCollection().primaryKeys()).toEqual(['b'])
    await wipeAll(db)
    for (const t of db.tables) expect(await t.count()).toBe(0)
  })

  it('finds a key by tag within a household only', async () => {
    await db.keys.bulkAdd([
      { ...key('k1', 'A', 'd'), tag_id: 'kf1:AAAAAAAAAAAAAAAA' },
      { ...key('k2', 'B', 'd'), tag_id: 'kf1:BBBBBBBBBBBBBBBB' },
    ])
    const hit = await db.keys
      .where('[household_id+tag_id]')
      .equals(['A', 'kf1:AAAAAAAAAAAAAAAA'])
      .first()
    const miss = await db.keys
      .where('[household_id+tag_id]')
      .equals(['A', 'kf1:BBBBBBBBBBBBBBBB'])
      .first()
    expect(hit?.id).toBe('k1')
    expect(miss).toBeUndefined()
  })
})
