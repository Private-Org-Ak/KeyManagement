/** Writes a 1-frame Y4M video of a QR code, used as Chrome's fake camera in qr.spec.ts. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import QRCode from 'qrcode'

export const E2E_QR_TAG = 'kf1:ABCDEFGHIJKLMNOP'

export function writeQrY4m(path: string, text: string = E2E_QR_TAG, w = 640, h = 480): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const quiet = 4
  const scale = Math.floor((Math.min(w, h) * 0.6) / (n + quiet * 2))
  const size = (n + quiet * 2) * scale
  const x0 = Math.floor((w - size) / 2)
  const y0 = Math.floor((h - size) / 2)
  const Y = Buffer.alloc(w * h, 200) // light grey background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - quiet
      const my = Math.floor(y / scale) - quiet
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(mx, my) === 1
      Y[(y0 + y) * w + (x0 + x)] = dark ? 16 : 235
    }
  }
  const chroma = Buffer.alloc((w / 2) * (h / 2), 128)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${w} H${h} F30:1 Ip A1:1 C420jpeg\n`),
      Buffer.from('FRAME\n'),
      Y,
      chroma,
      chroma,
    ]),
  )
  return path
}
