import Fuse from 'fuse.js'
import { canonical, normalize } from './normalize'

/** Minimal shapes the matcher needs (Dexie rows satisfy them). */
export interface MatchableKey {
  id: string
  door_id: string | null
  key_number: string
}
export interface MatchableDoor {
  id: string
  name: string
  room_group: string | null
}

export interface DoorGroup<K extends MatchableKey, D extends MatchableDoor> {
  /** null = keys that aren't assigned to any door yet. */
  door: D | null
  keys: K[]
  /** Lower is better. */
  score: number
}

// ---------------------------------------------------------------------------
// Levenshtein
// ---------------------------------------------------------------------------

/** Classic edit distance (insert/delete/substitute = 1). Early-exits above `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      curr[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length] ?? 0
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function groupByDoor<K extends MatchableKey, D extends MatchableDoor>(
  scored: { key: K; score: number }[],
  doorsById: Map<string, D>,
): DoorGroup<K, D>[] {
  const groups = new Map<string, DoorGroup<K, D>>()
  for (const { key, score } of scored) {
    const door = key.door_id ? (doorsById.get(key.door_id) ?? null) : null
    const gid = door?.id ?? '∅'
    const g = groups.get(gid)
    if (g) {
      if (!g.keys.includes(key)) g.keys.push(key)
      g.score = Math.min(g.score, score)
    } else {
      groups.set(gid, { door, keys: [key], score })
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.score - b.score || (a.door?.name ?? '~').localeCompare(b.door?.name ?? '~'),
  )
}

// ---------------------------------------------------------------------------
// Typed search (Home)
// ---------------------------------------------------------------------------

/**
 * Live search as the user types. Key numbers are matched on canonical forms
 * (exact < prefix < substring); door name / room group are matched with Fuse so
 * "master" finds the Master Bedroom keys. Results are grouped by door.
 */
export function searchTyped<K extends MatchableKey, D extends MatchableDoor>(
  query: string,
  keys: readonly K[],
  doors: readonly D[],
): DoorGroup<K, D>[] {
  const q = query.trim()
  if (q === '') return []
  const doorsById = new Map(doors.map((d) => [d.id, d]))
  const scored: { key: K; score: number }[] = []

  const cq = canonical(q)
  if (cq.length > 0) {
    for (const key of keys) {
      const ck = canonical(key.key_number)
      if (ck === cq) scored.push({ key, score: 0 })
      else if (ck.startsWith(cq)) scored.push({ key, score: 1 })
      else if (cq.length >= 2 && ck.includes(cq)) scored.push({ key, score: 2 })
    }
  }

  // Door-name search only for queries with letters (pure numbers are key numbers).
  if (/[a-z]/i.test(q) && q.length >= 2) {
    const fuse = new Fuse(doors, {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'room_group', weight: 0.3 },
      ],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      // Space-separated words must all match (fuzzily): "master wash" → Master Bedroom Washroom.
      useExtendedSearch: true,
    })
    // Strip extended-search operators so user input is always treated as plain words.
    const words = q.replace(/[!^=$'|]/g, ' ').trim()
    const doorHits = new Map(fuse.search(words).map((r) => [r.item.id, r.score ?? 1]))
    for (const key of keys) {
      const s = key.door_id ? doorHits.get(key.door_id) : undefined
      if (s !== undefined) scored.push({ key, score: 3 + s })
    }
  }

  return groupByDoor(scored, doorsById)
}

// ---------------------------------------------------------------------------
// Scanned search (OCR output)
// ---------------------------------------------------------------------------

export interface OcrCandidate {
  text: string
  /** 0–100 (Tesseract word confidence). */
  confidence: number
}

const MIN_LEN = 3
const MAX_LEN = 20

/**
 * Turns raw OCR words into candidate key numbers: each token, plus each adjacent pair
 * joined (engravings often have gaps: "KF 1021"). Keeps normalized lengths 3–20,
 * de-duplicated by normalized text (highest confidence wins).
 */
export function candidatesFromWords(words: readonly OcrCandidate[]): OcrCandidate[] {
  const tokens: OcrCandidate[] = []
  for (const w of words) {
    for (const part of w.text.split(/\s+/)) {
      const n = normalize(part)
      if (n) tokens.push({ text: n, confidence: w.confidence })
    }
  }
  const out = new Map<string, OcrCandidate>()
  const add = (text: string, confidence: number) => {
    if (text.length < MIN_LEN || text.length > MAX_LEN) return
    const prev = out.get(text)
    if (!prev || prev.confidence < confidence) out.set(text, { text, confidence })
  }
  tokens.forEach((t, i) => {
    add(t.text, t.confidence)
    const next = tokens[i + 1]
    if (next) add(t.text + next.text, Math.min(t.confidence, next.confidence))
  })
  return [...out.values()]
}

export interface ScanMatch<K extends MatchableKey, D extends MatchableDoor> {
  /** Exact canonical hits, grouped by door (all doors shown — master keys). */
  exact: DoorGroup<K, D>[]
  /** Fuzzy hits when there is no exact one: top 3 groups, require a tap. */
  fuzzy: DoorGroup<K, D>[]
  /** What we think we read (best candidate), for "I read: …" + edit. */
  read: string | null
}

export function maxDistanceFor(length: number): number {
  return length >= 6 ? 2 : 1
}

export function matchScanned<K extends MatchableKey, D extends MatchableDoor>(
  candidates: readonly OcrCandidate[],
  keys: readonly K[],
  doors: readonly D[],
): ScanMatch<K, D> {
  const doorsById = new Map(doors.map((d) => [d.id, d]))
  const byConf = [...candidates].sort((a, b) => b.confidence - a.confidence)
  const keyCanon = keys.map((k) => ({ key: k, c: canonical(k.key_number) }))

  // 1. Exact canonical match.
  const exactHits: { key: K; score: number }[] = []
  let exactRead: string | null = null
  for (const cand of byConf) {
    const cc = canonical(cand.text)
    for (const { key, c } of keyCanon) {
      if (c === cc) {
        exactHits.push({ key, score: 0 })
        exactRead ??= cand.text
      }
    }
  }
  if (exactHits.length > 0) {
    return { exact: groupByDoor(exactHits, doorsById), fuzzy: [], read: exactRead }
  }

  // 2. Fuzzy: Levenshtein on canonical forms; rank by distance, then confidence.
  const fuzzyHits: { key: K; score: number }[] = []
  for (const cand of byConf) {
    const cc = canonical(cand.text)
    for (const { key, c } of keyCanon) {
      const max = maxDistanceFor(Math.max(cc.length, c.length))
      const d = levenshtein(cc, c, max)
      if (d <= max) fuzzyHits.push({ key, score: d + (100 - cand.confidence) / 1000 })
    }
  }
  return {
    exact: [],
    fuzzy: groupByDoor(fuzzyHits, doorsById).slice(0, 3),
    read: byConf[0]?.text ?? null,
  }
}
