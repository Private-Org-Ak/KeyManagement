import { describe, expect, it } from 'vitest'
import { canonical, normalize } from './normalize'

describe('normalize (mirrors keys.key_number_normalized)', () => {
  it.each([
    ['kf-1021', 'KF1021'],
    [' 44 17 ', '4417'],
    ['b/208.', 'B208'],
    ['Ab_c-d', 'ABCD'],
    ['', ''],
    ['—', ''],
    // Postgres [^A-Za-z0-9] strips non-ASCII letters too.
    ['ÄB1', 'B1'],
  ])('%j → %j', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })
})

describe('canonical', () => {
  it('folds look-alike characters to digits', () => {
    expect(canonical('O5')).toBe('05')
    expect(canonical('IL0')).toBe('110')
    expect(canonical('SZGB')).toBe('5268')
    expect(canonical('q-d')).toBe('0D')
  })

  it('treats a misread number as equal to the stored one', () => {
    expect(canonical('KF-1O2I')).toBe(canonical('KF1021'))
    expect(canonical('B-2O8')).toBe(canonical('8208'))
  })

  it('keeps other letters', () => {
    expect(canonical('KF')).toBe('KF')
  })
})
