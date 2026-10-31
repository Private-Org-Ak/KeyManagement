/**
 * Key-number normalization. MUST equal the DB generated column
 * `keys.key_number_normalized` = upper(regexp_replace(key_number, '[^A-Za-z0-9]', '', 'g')).
 * (CLAUDE.md hard rule 6 — change both together.)
 */
export function normalize(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const LOOK_ALIKES: Record<string, string> = {
  O: '0',
  Q: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
}

/**
 * Comparison-only form: normalize, then fold characters OCR/humans confuse into digits.
 * Applied to both stored numbers and input. Never stored or displayed.
 */
export function canonical(input: string): string {
  let out = ''
  for (const ch of normalize(input)) out += LOOK_ALIKES[ch] ?? ch
  return out
}
