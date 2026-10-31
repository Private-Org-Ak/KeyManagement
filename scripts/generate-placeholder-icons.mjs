// Generates placeholder PWA icons (a simple key glyph) with no dependencies.
// Real artwork replaces these in ROADMAP Phase 11. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [90, 69, 230] // brand-600
const FG = [247, 204, 108] // accent-300 (brass)

function crc32(buf) {
  let c
  let crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Key glyph in unit coordinates, scaled by `s` around the centre (s < 1 keeps it
// inside the maskable safe zone).
function keyGlyph(s) {
  return (u, v) => {
    const x = (u - 0.5) / s + 0.5
    const y = (v - 0.5) / s + 0.5
    const dx = x - 0.34
    const dy = y - 0.5
    const d = Math.hypot(dx, dy)
    const ring = d < 0.17 && d > 0.09
    const shaft = x > 0.49 && x < 0.86 && Math.abs(y - 0.5) < 0.045
    const tooth1 = x > 0.74 && x < 0.8 && y > 0.5 && y < 0.62
    const tooth2 = x > 0.82 && x < 0.86 && y > 0.5 && y < 0.59
    return ring || shaft || tooth1 || tooth2 ? FG : BG
  }
}

mkdirSync('public/icons', { recursive: true })
const out = [
  ['public/icons/icon-192.png', 192, keyGlyph(0.9)],
  ['public/icons/icon-512.png', 512, keyGlyph(0.9)],
  ['public/icons/icon-512-maskable.png', 512, keyGlyph(0.7)],
  ['public/icons/apple-touch-icon.png', 180, keyGlyph(0.8)],
]
for (const [file, size, draw] of out) {
  writeFileSync(file, png(size, draw))
  console.log(`wrote ${file}`)
}
