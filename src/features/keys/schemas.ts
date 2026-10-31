import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .transform((v) => (v === '' ? null : v))

// Mirrors DB checks on public.keys.
export const keySchema = z.object({
  key_number: z
    .string()
    .trim()
    .min(1, 'Enter the number stamped on the key.')
    .max(40, 'Keep it under 40 characters.'),
  door_id: z.string().transform((v) => (v === '' ? null : v)),
  label: optionalText(40),
  holder: optionalText(60),
})
export type KeyFormIn = z.input<typeof keySchema>
export type KeyFormOut = z.output<typeof keySchema>

/** "Copy 1" → "Copy 2"; anything else → "Copy N" where N = existing copies + 1. */
export function nextCopyLabel(existingCopies: number): string {
  return `Copy ${existingCopies + 1}`
}
