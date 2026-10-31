import { z } from 'zod'
import { DOOR_TYPES } from '@/types/models'

// Mirrors DB checks on public.doors.
const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => (v === '' ? null : v))

export const doorSchema = z.object({
  name: z.string().trim().min(1, 'Give the door a name.').max(80, 'Keep it under 80 characters.'),
  room_group: optionalText(80, 'Keep it under 80 characters.'),
  floor: optionalText(40, 'Keep it under 40 characters.'),
  door_type: z
    .enum(DOOR_TYPES as [string, ...string[]])
    .transform((v) => v as (typeof DOOR_TYPES)[number]),
  notes: optionalText(500, 'Keep notes under 500 characters.'),
})
export type DoorFormIn = z.input<typeof doorSchema>
export type DoorFormOut = z.output<typeof doorSchema>

export const roomWithWashroomSchema = z.object({
  room: z.string().trim().min(1, 'Enter the room name.').max(70, 'Keep it under 70 characters.'),
  floor: optionalText(40, 'Keep it under 40 characters.'),
})
export type RoomFormIn = z.input<typeof roomWithWashroomSchema>
export type RoomFormOut = z.output<typeof roomWithWashroomSchema>

export function washroomName(room: string): string {
  return `${room.trim()} Washroom`
}
