import type { Page } from '@playwright/test'
import { requireStack } from './supabase'

/** Inserts doors + keys for `hid` via PostgREST as the signed-in user (RLS applies). */
export async function seedViaApi(
  page: Page,
  hid: string,
  entries: {
    door: string
    number: string
    type?: string
    floor?: string
    group?: string
    holder?: string
    label?: string
  }[],
): Promise<void> {
  const { apiUrl, anonKey } = requireStack()
  await page.evaluate(
    async ({ apiUrl, anonKey, hid, entries }) => {
      const k = Object.keys(localStorage).find(
        (x) => x.startsWith('sb-') && x.endsWith('-auth-token'),
      )
      const token =
        (JSON.parse(localStorage.getItem(k ?? '') ?? '{}') as { access_token?: string })
          .access_token ?? ''
      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }
      const doorsRes = await fetch(`${apiUrl}/rest/v1/doors`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          [...new Map(entries.map((e) => [e.door, e])).values()].map((e) => ({
            household_id: hid,
            name: e.door,
            door_type: e.type ?? 'room',
            floor: e.floor ?? null,
            room_group: e.group ?? null,
          })),
        ),
      })
      const doors = (await doorsRes.json()) as { id: string; name: string }[]
      const byName = new Map(doors.map((d) => [d.name, d.id]))
      const keysRes = await fetch(`${apiUrl}/rest/v1/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          entries.map((e) => ({
            household_id: hid,
            door_id: byName.get(e.door),
            key_number: e.number,
            holder: e.holder ?? null,
            label: e.label ?? null,
          })),
        ),
      })
      if (!keysRes.ok) throw new Error(`seed failed: ${keysRes.status}`)
    },
    { apiUrl, anonKey, hid, entries },
  )
}
