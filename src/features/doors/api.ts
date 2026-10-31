import { useMutation } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { PermissionDeniedError } from '@/lib/errors'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { syncHousehold } from '@/lib/sync'
import type { DoorRow } from '@/types/models'
import type { DoorFormOut, RoomFormOut } from './schemas'
import { washroomName } from './schemas'

// ---------- Reads (Dexie) ----------

export function useDoors(hid: string): DoorRow[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.doors.where('household_id').equals(hid).toArray()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [hid],
  )
}

export function useDoor(hid: string, did: string): DoorRow | null | undefined {
  return useLiveQuery(async () => {
    const d = await db.doors.get(did)
    return d && d.household_id === hid ? d : null
  }, [hid, did])
}

/** Key counts per door id (and '' for unassigned). */
export function useKeyCounts(hid: string): Map<string, number> | undefined {
  return useLiveQuery(async () => {
    const keys = await db.keys.where('household_id').equals(hid).toArray()
    const m = new Map<string, number>()
    for (const k of keys) m.set(k.door_id ?? '', (m.get(k.door_id ?? '') ?? 0) + 1)
    return m
  }, [hid])
}

export interface DoorSection {
  title: string
  doors: DoorRow[]
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Sort: main doors first, then by room group (a room right before its washroom), then name. */
export function compareDoors(a: DoorRow, b: DoorRow): number {
  const main = (d: DoorRow) => (d.door_type === 'main' ? 0 : 1)
  const inGroup = (d: DoorRow) => (d.door_type === 'washroom' ? 1 : 0)
  return (
    main(a) - main(b) ||
    collator.compare(a.room_group ?? a.name, b.room_group ?? b.name) ||
    inGroup(a) - inGroup(b) ||
    collator.compare(a.name, b.name)
  )
}

/** Groups doors by floor (floors in natural order, "no floor" last). */
export function groupDoors(doors: readonly DoorRow[]): DoorSection[] {
  const byFloor = new Map<string, DoorRow[]>()
  for (const d of doors) {
    const f = d.floor?.trim() ?? ''
    byFloor.set(f, [...(byFloor.get(f) ?? []), d])
  }
  return [...byFloor.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : collator.compare(a, b)))
    .map(([floor, ds]) => ({
      title: floor || (byFloor.size > 1 ? 'Other' : 'All doors'),
      doors: [...ds].sort(compareDoors),
    }))
}

// ---------- Mutations ----------

export function useCreateDoor(hid: string) {
  return useMutation({
    mutationFn: async (v: DoorFormOut) => {
      const { data, error } = await supabase
        .from('doors')
        .insert({ ...v, household_id: hid })
        .select('id')
        .single()
      if (error) throw error
      await syncHousehold(hid)
      return data.id
    },
  })
}

/** "Add room with washroom": two doors sharing a room_group, in one request. */
export function useCreateRoomWithWashroom(hid: string) {
  return useMutation({
    mutationFn: async ({ room, floor }: RoomFormOut) => {
      const name = room.trim()
      const { data, error } = await supabase
        .from('doors')
        .insert([
          { household_id: hid, name, room_group: name, floor, door_type: 'room' },
          {
            household_id: hid,
            name: washroomName(name),
            room_group: name,
            floor,
            door_type: 'washroom',
          },
        ])
        .select('id, door_type')
      if (error) throw error
      await syncHousehold(hid)
      return data
    },
  })
}

export function useUpdateDoor(hid: string, did: string) {
  return useMutation({
    mutationFn: async (v: DoorFormOut) => {
      const { error } = await supabase.from('doors').update(v).eq('id', did).eq('household_id', hid)
      if (error) throw error
      await syncHousehold(hid)
    },
  })
}

export function useDeleteDoor(hid: string) {
  return useMutation({
    mutationFn: async (did: string) => {
      const { data, error } = await supabase
        .from('doors')
        .delete()
        .eq('id', did)
        .eq('household_id', hid)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new PermissionDeniedError()
      await syncHousehold(hid)
    },
  })
}
