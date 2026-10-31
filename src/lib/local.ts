/**
 * Small per-device preferences in localStorage. Nothing here contains key numbers,
 * emails or names — only opaque ids (rule 7). All of it is wiped on sign-out.
 */
const PREFIX = 'kf.'
const LAST_HOUSEHOLD = 'kf.lastHousehold'
const recentKey = (hid: string) => `kf.recent.${hid}`
const MAX_RECENT = 8

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full or blocked — non-critical
  }
}

export function getLastHousehold(): string | null {
  return safeGet(LAST_HOUSEHOLD)
}
export function setLastHousehold(hid: string): void {
  safeSet(LAST_HOUSEHOLD, hid)
}

/** Recent lookups are stored as door ids only, newest first. */
export function getRecentDoors(hid: string): string[] {
  try {
    const v: unknown = JSON.parse(safeGet(recentKey(hid)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
export function pushRecentDoor(hid: string, doorId: string): void {
  const next = [doorId, ...getRecentDoors(hid).filter((d) => d !== doorId)].slice(0, MAX_RECENT)
  safeSet(recentKey(hid), JSON.stringify(next))
}

export function wipeHouseholdLocal(hid: string): void {
  try {
    localStorage.removeItem(recentKey(hid))
    if (getLastHousehold() === hid) localStorage.removeItem(LAST_HOUSEHOLD)
  } catch {
    // ignore
  }
}

/** Removes every kf.* key (sign-out). */
export function wipeLocal(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch {
    // ignore
  }
}

/** Only same-origin relative paths are allowed as post-login redirects. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (next.startsWith('/login')) return '/'
  return next
}
