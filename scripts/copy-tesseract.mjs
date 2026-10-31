// Self-hosts the OCR runtime under public/tesseract/ (no CDN; works offline after first use).
// Runs automatically before dev/build. Output is gitignored.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const out = 'public/tesseract'
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only cores (we run OEM.LSTM_ONLY); the worker picks one by CPU features.
  [
    'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
    'core/tesseract-core-lstm.wasm.js',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    'core/tesseract-core-simd-lstm.wasm.js',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
    'core/tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  [
    'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    'lang/eng.traineddata.gz',
  ],
]

mkdirSync(join(out, 'core'), { recursive: true })
mkdirSync(join(out, 'lang'), { recursive: true })
for (const [src, dest] of files) {
  const target = join(out, dest)
  if (!existsSync(src)) throw new Error(`Missing ${src} — run npm install`)
  if (existsSync(target) && statSync(target).size === statSync(src).size) continue
  copyFileSync(src, target)
  console.log(`tesseract: ${dest}`)
}
