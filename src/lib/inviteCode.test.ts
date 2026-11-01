import { describe, expect, it } from 'vitest'
import {
  cleanInviteCode,
  formatInviteCode,
  inviteLink,
  isValidInviteCode,
  inviteMessage,
  parseInvitePayload,
} from './inviteCode'

describe('invite codes', () => {
  it('cleans case, dashes and spaces', () => {
    expect(cleanInviteCode('ab12-cd34 ef56-7890')).toBe('AB12CD34EF567890')
  })
  it('validates length after cleaning', () => {
    expect(isValidInviteCode('ab12-cd34-ef56-7890')).toBe(true)
    expect(isValidInviteCode('ab12-cd34')).toBe(false)
    expect(isValidInviteCode('ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBe(false)
  })
  it('formats in groups of four', () => {
    expect(formatInviteCode('AB12CD34EF567890')).toBe('AB12-CD34-EF56-7890')
  })
  it('builds a join link with the bare code', () => {
    expect(inviteLink('ab12-cd34-ef56-7890', 'https://app.test')).toBe(
      'https://app.test/join/AB12CD34EF567890',
    )
  })

  it.each([
    ['https://key-management-two.vercel.app/join/AB12CD34EF567890', 'AB12CD34EF567890'],
    ['http://192.168.1.5:4173/join/ab12cd34ef567890/', 'AB12CD34EF567890'],
    ['https://app.test/join/AB12CD34EF567890?x=1', 'AB12CD34EF567890'],
    ['ab12-cd34-ef56-7890', 'AB12CD34EF567890'],
  ])('reads an invite from QR %j', (raw, code) => {
    expect(parseInvitePayload(raw)).toBe(code)
  })

  it.each([
    'kf1:ABCDEFGHIJKLMNOP',
    'https://app.test/join/AB12',
    'https://app.test/other/AB12CD34EF567890',
    'https://app.test/join/ZZZZZZZZZZZZZZZZ',
    'hello',
    '',
  ])('ignores %j', (raw) => {
    expect(parseInvitePayload(raw)).toBeNull()
  })

  it('writes share text that leads with the in-app route', () => {
    const m = inviteMessage('Our home', 'ab12cd34ef567890')
    expect(m).toContain('“Our home”')
    expect(m).toContain('Join with a code → enter AB12-CD34-EF56-7890')
    expect(m).toContain('expires in 7 days')
  })
})
