import { beforeEach, describe, expect, it } from 'vitest'
import {
  getLastHousehold,
  getRecentDoors,
  pushRecentDoor,
  safeNext,
  setLastHousehold,
  wipeHouseholdLocal,
  wipeLocal,
} from './local'

describe('local prefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps recent doors unique, newest first, capped at 8', () => {
    for (let i = 0; i < 10; i++) pushRecentDoor('h', `d${i}`)
    pushRecentDoor('h', 'd5')
    const r = getRecentDoors('h')
    expect(r[0]).toBe('d5')
    expect(r).toHaveLength(8)
    expect(new Set(r).size).toBe(8)
  })

  it('wipes one household or everything', () => {
    setLastHousehold('h1')
    pushRecentDoor('h1', 'd')
    pushRecentDoor('h2', 'd')
    localStorage.setItem('other', 'x')
    wipeHouseholdLocal('h1')
    expect(getLastHousehold()).toBeNull()
    expect(getRecentDoors('h1')).toEqual([])
    expect(getRecentDoors('h2')).toEqual(['d'])
    wipeLocal()
    expect(getRecentDoors('h2')).toEqual([])
    expect(localStorage.getItem('other')).toBe('x')
  })

  it('ignores corrupted recent data', () => {
    localStorage.setItem('kf.recent.h', '{bad')
    expect(getRecentDoors('h')).toEqual([])
  })
})

describe('safeNext', () => {
  it.each([
    ['/h/abc', '/h/abc'],
    ['/join/ABCD', '/join/ABCD'],
    [null, '/'],
    ['', '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/login?next=/x', '/'],
  ])('%j → %j', (input, out) => {
    expect(safeNext(input)).toBe(out)
  })
})
