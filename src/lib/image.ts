/**
 * Image helpers.
 *  - Browser-only: decode/resize/re-encode (re-encoding through a canvas strips EXIF).
 *  - Pure (unit-tested): OCR preprocessing on RGBA pixel buffers.
 */

export interface Pixels {
  width: number
  height: number
  /** RGBA, length = width * height * 4 (same layout as ImageData.data). */
  data: Uint8ClampedArray
}

// ---------------------------------------------------------------------------
// Pure pixel operations
// ---------------------------------------------------------------------------

/** Luma (BT.601), written back into R=G=B. Returns a new buffer. */
export function grayscale(img: Pixels): Pixels {
  const out = new Uint8ClampedArray(img.data.length)
  for (let i = 0; i < img.data.length; i += 4) {
    const y =
      0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0)
    out[i] = out[i + 1] = out[i + 2] = y
    out[i + 3] = 255
  }
  return { width: img.width, height: img.height, data: out }
}

/** Stretches the 2nd–98th percentile of a grayscale image to 0–255. */
export function contrastStretch(img: Pixels, lowPct = 0.02, highPct = 0.98): Pixels {
  const hist = new Uint32Array(256)
  const n = img.width * img.height
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] ?? 0
    hist[v] = (hist[v] ?? 0) + 1
  }
  let lo = 0
  let hi = 255
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v] ?? 0
    if (acc > n * lowPct) {
      lo = v
      break
    }
  }
  acc = 0
  for (let v = 255; v >= 0; v--) {
    acc += hist[v] ?? 0
    if (acc > n * (1 - highPct)) {
      hi = v
      break
    }
  }
  const range = Math.max(1, hi - lo)
  const out = new Uint8ClampedArray(img.data.length)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (((img.data[i] ?? 0) - lo) * 255) / range
    out[i] = out[i + 1] = out[i + 2] = v
    out[i + 3] = 255
  }
  return { width: img.width, height: img.height, data: out }
}

/**
 * Adaptive mean threshold (Bradley–Roth with an integral image): a pixel becomes black
 * when it is `c` darker than the mean of its window. Handles uneven lighting on metal.
 */
export function adaptiveThreshold(img: Pixels, windowFrac = 1 / 12, c = 8): Pixels {
  const { width: w, height: h } = img
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 1; y <= h; y++) {
    let rowSum = 0
    for (let x = 1; x <= w; x++) {
      rowSum += img.data[((y - 1) * w + (x - 1)) * 4] ?? 0
      integral[y * (w + 1) + x] = (integral[(y - 1) * (w + 1) + x] ?? 0) + rowSum
    }
  }
  const half = Math.max(1, Math.round((Math.max(w, h) * windowFrac) / 2))
  const out = new Uint8ClampedArray(img.data.length)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(h, y + half + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w, x + half + 1)
      const sum =
        (integral[y1 * (w + 1) + x1] ?? 0) -
        (integral[y0 * (w + 1) + x1] ?? 0) -
        (integral[y1 * (w + 1) + x0] ?? 0) +
        (integral[y0 * (w + 1) + x0] ?? 0)
      const mean = sum / ((x1 - x0) * (y1 - y0))
      const i = (y * w + x) * 4
      const v = (img.data[i] ?? 0) < mean - c ? 0 : 255
      out[i] = out[i + 1] = out[i + 2] = v
      out[i + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

export function invert(img: Pixels): Pixels {
  const out = new Uint8ClampedArray(img.data.length)
  for (let i = 0; i < img.data.length; i += 4) {
    out[i] = 255 - (img.data[i] ?? 0)
    out[i + 1] = 255 - (img.data[i + 1] ?? 0)
    out[i + 2] = 255 - (img.data[i + 2] ?? 0)
    out[i + 3] = img.data[i + 3] ?? 255
  }
  return { width: img.width, height: img.height, data: out }
}

export function rotate180(img: Pixels): Pixels {
  const out = new Uint8ClampedArray(img.data.length)
  const px = img.width * img.height
  for (let p = 0; p < px; p++) {
    const s = p * 4
    const d = (px - 1 - p) * 4
    out[d] = img.data[s] ?? 0
    out[d + 1] = img.data[s + 1] ?? 0
    out[d + 2] = img.data[s + 2] ?? 0
    out[d + 3] = img.data[s + 3] ?? 255
  }
  return { width: img.width, height: img.height, data: out }
}

/** grayscale → contrast stretch → adaptive threshold; returns [normal, inverted]. */
export function preprocessForOcr(img: Pixels): [Pixels, Pixels] {
  const bin = adaptiveThreshold(contrastStretch(grayscale(img)))
  return [bin, invert(bin)]
}

/**
 * Focus measure: variance of the Laplacian on the luma channel. Higher = sharper.
 * Used to pick the least shaky of a few camera frames.
 */
export function sharpness(img: Pixels): number {
  const { width: w, height: h, data } = img
  const luma = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)
  }
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = luma(x - 1, y) + luma(x + 1, y) + luma(x, y - 1) + luma(x, y + 1) - 4 * luma(x, y)
      sum += v
      sumSq += v * v
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

/** Value of channel 0 (grayscale images keep R=G=B). */
function lum(img: Pixels, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4] ?? 0
}

function fromValues(width: number, height: number, values: ArrayLike<number>): Pixels {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let p = 0; p < width * height; p++) {
    const v = values[p] ?? 0
    out[p * 4] = out[p * 4 + 1] = out[p * 4 + 2] = v
    out[p * 4 + 3] = 255
  }
  return { width, height, data: out }
}

/** Mean filter over a (2rx+1)×(2ry+1) window (integral image); grayscale in → grayscale out. */
export function boxBlur(img: Pixels, rx: number, ry = rx): Pixels {
  const { width: w, height: h } = img
  const W = w + 1
  const integral = new Float64Array(W * (h + 1))
  for (let y = 1; y <= h; y++) {
    let row = 0
    for (let x = 1; x <= w; x++) {
      row += lum(img, x - 1, y - 1)
      integral[y * W + x] = (integral[(y - 1) * W + x] ?? 0) + row
    }
  }
  const values = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - ry)
    const y1 = Math.min(h, y + ry + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rx)
      const x1 = Math.min(w, x + rx + 1)
      const sum =
        (integral[y1 * W + x1] ?? 0) -
        (integral[y0 * W + x1] ?? 0) -
        (integral[y1 * W + x0] ?? 0) +
        (integral[y0 * W + x0] ?? 0)
      values[y * w + x] = sum / ((x1 - x0) * (y1 - y0))
    }
  }
  return fromValues(w, h, values)
}

/**
 * Flattens uneven lighting (glare bands, shadows on curved metal): each pixel divided by a
 * heavily blurred copy of the image. Small details such as stamped digits survive.
 */
export function normalizeBackground(gray: Pixels, radius: number): Pixels {
  const bg = boxBlur(gray, Math.max(1, Math.round(radius)))
  const n = gray.width * gray.height
  const values = new Float64Array(n)
  for (let p = 0; p < n; p++) {
    values[p] = (180 * (gray.data[p * 4] ?? 0)) / Math.max(1, bg.data[p * 4] ?? 0)
  }
  return fromValues(gray.width, gray.height, values)
}

/** Otsu's global threshold → black text on white (dark side becomes 0). */
export function otsuBinarize(gray: Pixels): Pixels {
  const hist = new Float64Array(256)
  const n = gray.width * gray.height
  for (let p = 0; p < n; p++) hist[gray.data[p * 4] ?? 0] = (hist[gray.data[p * 4] ?? 0] ?? 0) + 1
  let sumAll = 0
  for (let v = 0; v < 256; v++) sumAll += v * (hist[v] ?? 0)
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 127
  for (let v = 0; v < 256; v++) {
    wB += hist[v] ?? 0
    if (wB === 0) continue
    const wF = n - wB
    if (wF === 0) break
    sumB += v * (hist[v] ?? 0)
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) {
      best = between
      threshold = v
    }
  }
  const values = new Uint8ClampedArray(n)
  for (let p = 0; p < n; p++) values[p] = (gray.data[p * 4] ?? 0) <= threshold ? 0 : 255
  return fromValues(gray.width, gray.height, values)
}

export function cropPixels(
  img: Pixels,
  r: { x: number; y: number; width: number; height: number },
): Pixels {
  const x0 = Math.max(0, Math.round(r.x))
  const y0 = Math.max(0, Math.round(r.y))
  const w = Math.max(1, Math.min(img.width - x0, Math.round(r.width)))
  const h = Math.max(1, Math.min(img.height - y0, Math.round(r.height)))
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const start = ((y0 + y) * img.width + x0) * 4
    out.set(img.data.subarray(start, start + w * 4), y * w * 4)
  }
  return { width: w, height: h, data: out }
}

/** Bilinear resize of a grayscale image. */
export function resizeGray(img: Pixels, width: number, height: number): Pixels {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const sx = img.width / w
  const sy = img.height / h
  const values = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(img.height - 1, y0 + 1)
    const dy = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(img.width - 1, x0 + 1)
      const dx = fx - x0
      const top = lum(img, x0, y0) * (1 - dx) + lum(img, x1, y0) * dx
      const bottom = lum(img, x0, y1) * (1 - dx) + lum(img, x1, y1) * dx
      values[y * w + x] = top * (1 - dy) + bottom * dy
    }
  }
  return fromValues(w, h, values)
}

/** Longest run of indices where `profile[i] >= threshold`, allowing gaps up to `maxGap`, containing `peak`. */
function runAround(
  profile: Float64Array,
  peak: number,
  threshold: number,
  maxGap: number,
): [number, number] {
  let lo = peak
  let hi = peak
  let gap = 0
  for (let i = peak - 1; i >= 0; i--) {
    if ((profile[i] ?? 0) >= threshold) {
      lo = i
      gap = 0
    } else if (++gap > maxGap) break
  }
  gap = 0
  for (let i = peak + 1; i < profile.length; i++) {
    if ((profile[i] ?? 0) >= threshold) {
      hi = i
      gap = 0
    } else if (++gap > maxGap) break
  }
  return [lo, hi]
}

/**
 * Finds the strongest line of text (e.g. a stamped number on a key) in a grayscale image:
 * edge energy after denoising → densest row band → its horizontal extent. Returns a padded
 * box, or null when nothing stands out (then the whole image is used).
 */
export function locateText(
  gray: Pixels,
): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h } = gray
  if (w < 16 || h < 16) return null
  // Flatten lighting first so glare bands and shadows don't look like edges.
  const flat = normalizeBackground(gray, Math.max(4, Math.round(Math.min(w, h) / 10)))
  const smooth = boxBlur(flat, Math.max(1, Math.round(Math.min(w, h) / 150)))
  const energy = new Float64Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = lum(smooth, x + 1, y) - lum(smooth, x - 1, y)
      const gy = lum(smooth, x, y + 1) - lum(smooth, x, y - 1)
      energy[y * w + x] = Math.abs(gx) + Math.abs(gy)
    }
  }
  // Ignore weak texture (brushed metal, sensor noise): keep only the strongest edges.
  const sorted = Float64Array.from(energy).sort()
  const cut = sorted[Math.floor(sorted.length * 0.97)] ?? 0
  const rows = new Float64Array(h)
  for (let y = 0; y < h; y++) {
    let s = 0
    for (let x = 0; x < w; x++) {
      const e = energy[y * w + x] ?? 0
      if (e > cut) s += e - cut
    }
    rows[y] = s
  }
  const rowsSmooth = new Float64Array(h)
  const rr = Math.max(1, Math.round(h / 60))
  for (let y = 0; y < h; y++) {
    let s = 0
    let c = 0
    for (let k = Math.max(0, y - rr); k <= Math.min(h - 1, y + rr); k++) {
      s += rows[k] ?? 0
      c++
    }
    rowsSmooth[y] = s / c
  }
  let peakY = 0
  for (let y = 0; y < h; y++) if ((rowsSmooth[y] ?? 0) > (rowsSmooth[peakY] ?? 0)) peakY = y
  const peakRow = rowsSmooth[peakY] ?? 0
  if (peakRow <= 0) return null
  const [top, bottom] = runAround(rowsSmooth, peakY, peakRow * 0.35, Math.round(h / 50))
  const bandH = bottom - top + 1
  if (bandH < 6 || bandH > h * 0.9) return null

  const cols = new Float64Array(w)
  for (let x = 0; x < w; x++) {
    let s = 0
    for (let y = top; y <= bottom; y++) {
      const e = energy[y * w + x] ?? 0
      if (e > cut) s += e - cut
    }
    cols[x] = s
  }
  const colsSmooth = boxProfile(cols, Math.max(2, Math.round(bandH / 3)))
  let peakX = 0
  for (let x = 0; x < w; x++) if ((colsSmooth[x] ?? 0) > (colsSmooth[peakX] ?? 0)) peakX = x
  const peakCol = colsSmooth[peakX] ?? 0
  const [left, right] = runAround(colsSmooth, peakX, peakCol * 0.12, Math.round(bandH * 1.5))

  const padY = Math.round(bandH * 0.45)
  const padX = Math.round(bandH * 0.6)
  const x = Math.max(0, left - padX)
  const y = Math.max(0, top - padY)
  return {
    x,
    y,
    width: Math.min(w, right + padX + 1) - x,
    height: Math.min(h, bottom + padY + 1) - y,
  }
}

function boxProfile(p: Float64Array, r: number): Float64Array {
  const out = new Float64Array(p.length)
  for (let i = 0; i < p.length; i++) {
    let s = 0
    let c = 0
    for (let k = Math.max(0, i - r); k <= Math.min(p.length - 1, i + r); k++) {
      s += p[k] ?? 0
      c++
    }
    out[i] = s / c
  }
  return out
}

/**
 * Tight crop around the located text, scaled so the text line is ~`lineHeight` px tall,
 * with lighting flattened. This is what Tesseract reads best for stamped keys.
 */
export function focusOnText(src: Pixels, lineHeight = 110): Pixels | null {
  const gray = grayscale(src)
  const box = locateText(gray)
  if (!box) return null
  const crop = cropPixels(gray, box)
  const scale = Math.min(lineHeight / crop.height, 1800 / crop.width, 4)
  const sized = resizeGray(crop, crop.width * scale, crop.height * scale)
  const flat = normalizeBackground(boxBlur(sized, 1), sized.height * 0.6)
  return contrastStretch(flat, 0.01, 0.99)
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: AnyCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = c.getContext(
    '2d',
    {
      willReadFrequently: true,
    },
  )
  if (!ctx) throw new Error('Canvas 2D is not available')
  return ctx
}

async function canvasToBlob(c: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    c.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('Encoding failed'))
      },
      type,
      quality,
    )
  })
}

export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/**
 * Decode (respecting EXIF orientation), downscale to `maxDim`, re-encode as JPEG.
 * Re-encoding drops all metadata, including GPS EXIF.
 */
export async function resizeToJpeg(blob: Blob, maxDim: number, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim)
    const canvas = makeCanvas(width, height)
    const ctx = ctx2d(canvas)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    return await canvasToBlob(canvas, 'image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}

/** Reads pixels from a drawable source region, scaled to `targetWidth`. */
export function readPixels(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetWidth: number,
): Pixels {
  const scale = targetWidth / sw
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  const canvas = makeCanvas(width, height)
  const ctx = ctx2d(canvas)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  return { width, height, data }
}

/** Pixels → PNG/JPEG blob (used to hand preprocessed frames to Tesseract / the fallback). */
export async function pixelsToBlob(img: Pixels, type = 'image/png', quality = 0.9): Promise<Blob> {
  const canvas = makeCanvas(img.width, img.height)
  const ctx = ctx2d(canvas)
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  return canvasToBlob(canvas, type, quality)
}
