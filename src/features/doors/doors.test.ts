import { describe, expect, it, vi } from 'vitest'
import type { DoorRow } from '@/types/models'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const { groupDoors } = await import('./api')
const { washroomName } = await import('./schemas')

function door(name: string, extra: Partial<DoorRow> = {}): DoorRow {
  return {
    id: name,
    household_id: 'h',
    name,
    room_group: null,
    floor: null,
    door_type: 'room',
    notes: null,
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

describe('groupDoors', () => {
  it('puts main doors first and keeps a room next to its washroom', () => {
    const [section] = groupDoors([
      door('Kitchen', { door_type: 'other' }),
      door('Bedroom 2 Washroom', { room_group: 'Bedroom 2', door_type: 'washroom' }),
      door('Bedroom 10', { room_group: 'Bedroom 10' }),
      door('Main Door', { door_type: 'main' }),
      door('Bedroom 2', { room_group: 'Bedroom 2' }),
    ])
    expect(section?.title).toBe('All doors')
    expect(section?.doors.map((d) => d.name)).toEqual([
      'Main Door',
      'Bedroom 2',
      'Bedroom 2 Washroom',
      'Bedroom 10',
      'Kitchen',
    ])
  })

  it('sections by floor in natural order with no-floor last', () => {
    const titles = groupDoors([
      door('A', { floor: 'Floor 10' }),
      door('B', { floor: 'Floor 2' }),
      door('C'),
    ]).map((s) => s.title)
    expect(titles).toEqual(['Floor 2', 'Floor 10', 'Other'])
  })
})

describe('washroomName', () => {
  it('appends Washroom', () => {
    expect(washroomName(' Master Bedroom ')).toBe('Master Bedroom Washroom')
  })
})
