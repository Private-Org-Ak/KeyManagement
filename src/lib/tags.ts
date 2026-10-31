/**
 * Key-ring tags. QR payload `kf1:<16 base32 chars>` (80 random bits) — opaque, contains no
 * household information. NFC tags use the reader-supplied serial: `nfc:<serial>`.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // RFC 4648 base32
export const QR_PREFIX = 'kf1:'
export const NFC_PREFIX = 'nfc:'

type Random = (buf: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>
const secureRandom: Random = (b) => crypto.getRandomValues(b)

export function newQrTagId(random: Random = secureRandom): string {
  const bytes = random(new Uint8Array(16))
  let out = ''
  for (let i = 0; i < 16; i++) out += ALPHABET.charAt((bytes[i] ?? 0) & 31)
  return QR_PREFIX + out
}

/** Returns the canonical tag id for a scanned QR payload, or null if it isn't ours. */
export function parseQrPayload(raw: string): string | null {
  const s = raw.trim()
  const m = /^kf1:([A-Z2-7]{16})$/i.exec(s)
  return m?.[1] ? QR_PREFIX + m[1].toUpperCase() : null
}

export function nfcTagId(serialNumber: string): string | null {
  const s = serialNumber.trim().toLowerCase()
  if (!/^[0-9a-f:]{4,100}$/.test(s)) return null
  return NFC_PREFIX + s
}

/** Short human-readable suffix printed under each QR code. */
export function tagShortLabel(tagId: string): string {
  if (tagId.startsWith(QR_PREFIX)) return tagId.slice(-6)
  if (tagId.startsWith(NFC_PREFIX)) return 'NFC ' + tagId.slice(-5)
  return tagId.slice(-6)
}
