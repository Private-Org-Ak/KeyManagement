import type { Worker } from 'tesseract.js'
import {
  contrastStretch,
  focusOnText,
  grayscale,
  invert,
  otsuBinarize,
  pixelsToBlob,
  preprocessForOcr,
  rotate180,
  type Pixels,
} from '@/lib/image'
import { candidatesFromWords, type OcrCandidate } from '@/lib/match'

const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
let workerPromise: Promise<Worker> | null = null

/**
 * One Tesseract worker, created lazily on first use and then reused. Worker, core and
 * language data are self-hosted under /tesseract/ (no CDN) and runtime-cached by the SW.
 */
export function getOcrWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js')
    const worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/core',
      langPath: '/tesseract/lang',
      gzip: true,
      workerBlobURL: false,
    })
    await worker.setParameters({ tessedit_char_whitelist: WHITELIST, user_defined_dpi: '300' })
    return worker
  })().catch((e: unknown) => {
    workerPromise = null
    throw e
  })
  return workerPromise
}

/** Warm up the worker (e.g. when the Scan screen opens) without blocking. */
export function preloadOcr(): void {
  void getOcrWorker().catch(() => undefined)
}

export interface OcrRun {
  candidates: OcrCandidate[]
  ms: number
  attempts: number
}

interface RecognizedWord {
  text: string
  confidence: number
}

function wordsOf(data: {
  blocks: { paragraphs: { lines: { words: RecognizedWord[] }[] }[] }[] | null
}): RecognizedWord[] {
  return (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
  )
}

/**
 * Image variants in order of likelihood. First a tight, lighting-flattened crop around the
 * located text (stamped keys: small digits on textured metal), then the whole frame
 * (plain contrast, binarized, inverted), then everything upside down.
 */
export function ocrVariants(src: Pixels): Pixels[] {
  const focused = focusOnText(src)
  const near = focused ? [focused, otsuBinarize(focused), invert(otsuBinarize(focused))] : []
  const gray = contrastStretch(grayscale(src))
  const [bin, inv] = preprocessForOcr(src)
  const upright = [...near, gray, bin, inv]
  return [...upright, ...upright.map(rotate180)]
}

/**
 * Runs OCR over the variants: PSM 7 (single line) first, PSM 11 (sparse) only if 7 finds
 * nothing. Stops as soon as `isDone(candidates)` says we have an exact match.
 */
export async function readNumber(
  src: Pixels,
  isDone: (c: OcrCandidate[]) => boolean,
): Promise<OcrRun> {
  const t0 = performance.now()
  const worker = await getOcrWorker()
  const { PSM } = await import('tesseract.js')
  const all = new Map<string, OcrCandidate>()
  let attempts = 0

  for (const variant of ocrVariants(src)) {
    const image = await pixelsToBlob(variant)
    for (const psm of [PSM.SINGLE_LINE, PSM.SPARSE_TEXT]) {
      attempts++
      await worker.setParameters({ tessedit_pageseg_mode: psm })
      const { data } = await worker.recognize(image, {}, { blocks: true, text: true })
      const found = candidatesFromWords(wordsOf(data))
      for (const c of found) {
        const prev = all.get(c.text)
        if (!prev || prev.confidence < c.confidence) all.set(c.text, c)
      }
      if (found.length > 0) break
    }
    if (isDone([...all.values()])) break
  }
  return { candidates: [...all.values()], ms: performance.now() - t0, attempts }
}
