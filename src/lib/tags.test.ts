import { describe, expect, it } from 'vitest'
import { newQrTagId, nfcTagId, parseQrPayload, tagShortLabel } from './tags'

describe('tags', () => {
  it('generates kf1: + 16 base32 chars', () => {
    const id = newQrTagId()
    expect(id).toMatch(/^kf1:[A-Z2-7]{16}$/)
    expect(newQrTagId()).not.toBe(id)
  })
  it('is deterministic for a given random source', () => {
    expect(newQrTagId((b) => b.fill(0))).toBe('kf1:AAAAAAAAAAAAAAAA')
  })
  it('parses only our payloads, case-insensitively', () => {
    expect(parseQrPayload(' kf1:abcdefghijklmnop ')).toBe('kf1:ABCDEFGHIJKLMNOP')
    expect(parseQrPayload('https://evil.example')).toBeNull()
    expect(parseQrPayload('kf1:ABC')).toBeNull()
    expect(parseQrPayload('kf1:ABCDEFGHIJKLMNO1')).toBeNull() // 1 is not base32
  })
  it('builds NFC ids from serial numbers', () => {
    expect(nfcTagId('04:A2:3B:FF')).toBe('nfc:04:a2:3b:ff')
    expect(nfcTagId('')).toBeNull()
    expect(nfcTagId('<script>')).toBeNull()
  })
  it('makes a short label', () => {
    expect(tagShortLabel('kf1:ABCDEFGHIJKLMNOP')).toBe('KLMNOP')
  })
})
