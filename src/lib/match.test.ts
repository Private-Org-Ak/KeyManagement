import { describe, expect, it } from 'vitest'
import {
  candidatesFromWords,
  levenshtein,
  matchScanned,
  maxDistanceFor,
  searchTyped,
  type MatchableDoor,
  type MatchableKey,
} from './match'

const doors: MatchableDoor[] = [
  { id: 'main', name: 'Main Door', room_group: null },
  { id: 'mb', name: 'Master Bedroom', room_group: 'Master Bedroom' },
  { id: 'mbw', name: 'Master Bedroom Washroom', room_group: 'Master Bedroom' },
  { id: 'guest', name: 'Guest Room', room_group: 'Guest Room' },
  { id: 'store', name: 'Store Room', room_group: null },
]

const keys: MatchableKey[] = [
  { id: 'k1', door_id: 'main', key_number: 'KF-1021' },
  { id: 'k2', door_id: 'main', key_number: 'KF-1021' }, // second copy
  { id: 'k3', door_id: 'mb', key_number: '4417' },
  { id: 'k4', door_id: 'mbw', key_number: '4418' },
  { id: 'k5', door_id: 'guest', key_number: 'B-208' },
  { id: 'k6', door_id: 'store', key_number: '0S5' },
  { id: 'k7', door_id: null, key_number: '9001' }, // unassigned
  // master key: same number opens two doors
  { id: 'k8', door_id: 'mb', key_number: 'M-77' },
  { id: 'k9', door_id: 'guest', key_number: 'M-77' },
]

const doorIds = (groups: { door: MatchableDoor | null }[]) => groups.map((g) => g.door?.id ?? null)

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['abc', 'abc', 0],
    ['abc', 'abd', 1],
    ['abc', 'ab', 1],
    ['kitten', 'sitting', 3],
    ['4417', '4471', 2],
  ])('%s ↔ %s = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d)
  })

  it('early-exits above max', () => {
    expect(levenshtein('aaaaaaaa', 'bbbbbbbb', 2)).toBe(3)
  })

  it('max distance is 1 for short and 2 for ≥ 6 chars', () => {
    expect(maxDistanceFor(5)).toBe(1)
    expect(maxDistanceFor(6)).toBe(2)
  })
})

describe('searchTyped', () => {
  it('returns nothing for an empty query', () => {
    expect(searchTyped('  ', keys, doors)).toEqual([])
  })

  it('finds a door by an exact number, grouping both copies', () => {
    const res = searchTyped('kf1021', keys, doors)
    expect(doorIds(res)).toEqual(['main'])
    expect(res[0]?.keys.map((k) => k.id)).toEqual(['k1', 'k2'])
  })

  it('matches by prefix and ranks exact before prefix', () => {
    const res = searchTyped('441', keys, doors)
    expect(doorIds(res)).toEqual(['mb', 'mbw'])
    expect(doorIds(searchTyped('4417', keys, doors))[0]).toBe('mb')
  })

  it('ignores punctuation and case, and folds look-alikes', () => {
    expect(doorIds(searchTyped('b 2O8', keys, doors))).toEqual(['guest'])
    expect(doorIds(searchTyped('OS5', keys, doors))).toEqual(['store'])
  })

  it('matches a substring of 2+ chars', () => {
    expect(doorIds(searchTyped('021', keys, doors))).toContain('main')
  })

  it('shows every door for a master key number', () => {
    expect(doorIds(searchTyped('M-77', keys, doors)).sort()).toEqual(['guest', 'mb'])
  })

  it('finds keys by door name', () => {
    const res = searchTyped('master', keys, doors)
    expect(doorIds(res)).toEqual(expect.arrayContaining(['mb', 'mbw']))
    expect(doorIds(res)).not.toContain('main')
  })

  it('matches several partial words against a door (AND)', () => {
    expect(doorIds(searchTyped('master wash', keys, doors))).toEqual(['mbw'])
    expect(doorIds(searchTyped('guest', keys, doors))).toEqual(['guest'])
  })

  it('treats operator characters in input as plain text', () => {
    expect(() => searchTyped("!master 'x |y", keys, doors)).not.toThrow()
  })

  it('groups keys with no door under null', () => {
    expect(doorIds(searchTyped('9001', keys, doors))).toEqual([null])
  })

  it('is fast enough on 40 keys (< 100 ms)', () => {
    const many: MatchableKey[] = Array.from({ length: 40 }, (_, i) => ({
      id: `x${i}`,
      door_id: doors[i % doors.length]?.id ?? null,
      key_number: `KF-${1000 + i}`,
    }))
    const t = performance.now()
    for (let i = 0; i < 10; i++) searchTyped('kf10', many, doors)
    expect((performance.now() - t) / 10).toBeLessThan(100)
  })
})

describe('candidatesFromWords', () => {
  it('normalizes tokens and joins adjacent pairs (engraving gaps)', () => {
    const c = candidatesFromWords([
      { text: 'KF', confidence: 90 },
      { text: '1021', confidence: 80 },
    ])
    expect(c.map((x) => x.text).sort()).toEqual(['1021', 'KF1021'])
    expect(c.find((x) => x.text === 'KF1021')?.confidence).toBe(80)
  })

  it('drops candidates shorter than 3 or longer than 20', () => {
    const c = candidatesFromWords([
      { text: 'A1', confidence: 90 },
      { text: 'X'.repeat(21), confidence: 90 },
    ])
    expect(c).toEqual([])
  })

  it('splits multi-word lines and dedupes keeping the best confidence', () => {
    const c = candidatesFromWords([
      { text: '4417 4417', confidence: 50 },
      { text: '4417', confidence: 70 },
    ])
    expect(c.find((x) => x.text === '4417')?.confidence).toBe(70)
  })
})

describe('matchScanned', () => {
  it('returns a single exact hit', () => {
    const r = matchScanned([{ text: '4417', confidence: 88 }], keys, doors)
    expect(doorIds(r.exact)).toEqual(['mb'])
    expect(r.fuzzy).toEqual([])
    expect(r.read).toBe('4417')
  })

  it('treats OCR look-alike errors as exact', () => {
    const r = matchScanned([{ text: 'KFIO2I', confidence: 60 }], keys, doors)
    expect(doorIds(r.exact)).toEqual(['main'])
  })

  it('finds a joined pair as exact', () => {
    const words = candidatesFromWords([
      { text: 'B', confidence: 70 },
      { text: '208', confidence: 90 },
    ])
    expect(doorIds(matchScanned(words, keys, doors).exact)).toEqual(['guest'])
  })

  it('falls back to fuzzy (distance 1 for short numbers), top 3', () => {
    const r = matchScanned([{ text: '4419', confidence: 70 }], keys, doors)
    expect(r.exact).toEqual([])
    expect(doorIds(r.fuzzy)).toEqual(expect.arrayContaining(['mb', 'mbw']))
    expect(r.fuzzy.length).toBeLessThanOrEqual(3)
    expect(r.read).toBe('4419')
  })

  it('allows distance 2 for numbers of length ≥ 6', () => {
    const r = matchScanned([{ text: 'KF1099', confidence: 70 }], keys, doors)
    expect(doorIds(r.fuzzy)).toEqual(['main'])
  })

  it('returns nothing for unrelated text', () => {
    const r = matchScanned([{ text: 'ZZZZZZZZ', confidence: 90 }], keys, doors)
    expect(r.exact).toEqual([])
    expect(r.fuzzy).toEqual([])
  })

  it('shows all doors for a master key', () => {
    const r = matchScanned([{ text: 'M77', confidence: 90 }], keys, doors)
    expect(doorIds(r.exact).sort()).toEqual(['guest', 'mb'])
  })
})
