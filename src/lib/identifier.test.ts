import { describe, expect, it } from 'vitest'
import { accountLabel, parseIdentifier } from './identifier'

describe('parseIdentifier', () => {
  it.each([
    ['Alice@Example.com ', { kind: 'email', email: 'alice@example.com' }],
    ['+91 98765 43210', { kind: 'phone', phone: '+919876543210' }],
    ['9876543210', { kind: 'phone', phone: '+919876543210' }],
    ['09876543210', { kind: 'phone', phone: '+919876543210' }],
    ['(987) 654-3210', { kind: 'phone', phone: '+919876543210' }],
    ['0044 7700 900123', { kind: 'phone', phone: '+447700900123' }],
    ['+1-415-555-0100', { kind: 'phone', phone: '+14155550100' }],
  ])('parses %j', (raw, expected) => {
    expect(parseIdentifier(raw)).toEqual(expected)
  })

  it.each([
    '',
    '   ',
    'alice@',
    'not an email',
    '12345',
    '+0123456789',
    '+1234567890123456',
    'abc123',
  ])('rejects %j', (raw) => {
    expect(parseIdentifier(raw)).toBeNull()
  })
})

describe('accountLabel', () => {
  it('prefers email, then formats the phone', () => {
    expect(accountLabel({ email: 'a@b.co', phone: '919876543210' })).toBe('a@b.co')
    expect(accountLabel({ email: '', phone: '919876543210' })).toBe('+919876543210')
    expect(accountLabel({})).toBeNull()
  })
})
