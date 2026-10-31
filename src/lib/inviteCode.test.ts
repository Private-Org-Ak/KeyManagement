import { describe, expect, it } from 'vitest'
import { cleanInviteCode, formatInviteCode, inviteLink, isValidInviteCode } from './inviteCode'

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
})
