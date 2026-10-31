import { describe, expect, it } from 'vitest'
import {
  adaptiveThreshold,
  boxBlur,
  contrastStretch,
  cropPixels,
  fitWithin,
  focusOnText,
  grayscale,
  invert,
  locateText,
  normalizeBackground,
  otsuBinarize,
  preprocessForOcr,
  resizeGray,
  rotate180,
  sharpness,
  type Pixels,
} from './image'

function img(
  width: number,
  height: number,
  f: (x: number, y: number) => [number, number, number],
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = f(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  return { width, height, data }
}
const px = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4]

describe('pixel ops', () => {
  it('grayscale uses BT.601 luma', () => {
    const g = grayscale(img(1, 1, () => [255, 0, 0]))
    expect(px(g, 0, 0)).toBe(76)
  })

  it('contrast stretch maps the range to 0..255', () => {
    const s = contrastStretch(
      img(10, 1, (x) => [100 + x, 100 + x, 100 + x]),
      0,
      1,
    )
    expect(px(s, 0, 0)).toBe(0)
    expect(px(s, 9, 0)).toBe(255)
  })

  it('adaptive threshold finds a dark stroke on an unevenly lit background', () => {
    // Background brightens left→right; a dark vertical stroke at x=20.
    const src = img(40, 20, (x) => {
      const bg = 120 + x * 3
      const v = x === 20 ? bg - 60 : bg
      return [v, v, v]
    })
    const t = adaptiveThreshold(src)
    expect(px(t, 20, 10)).toBe(0)
    expect(px(t, 5, 10)).toBe(255)
    expect(px(t, 35, 10)).toBe(255)
  })

  it('invert and rotate180 are involutions', () => {
    const src = img(3, 2, (x, y) => [x * 50, y * 50, 7])
    expect(invert(invert(src)).data).toEqual(src.data)
    expect(rotate180(rotate180(src)).data).toEqual(src.data)
    expect(px(rotate180(src), 0, 0)).toBe(px(src, 2, 1))
  })

  it('preprocessForOcr returns normal and inverted binary images', () => {
    const [a, b] = preprocessForOcr(img(8, 8, (x) => (x < 4 ? [20, 20, 20] : [220, 220, 220])))
    for (let i = 0; i < a.data.length; i += 4) {
      expect([0, 255]).toContain(a.data[i])
      expect(b.data[i]).toBe(255 - (a.data[i] ?? 0))
    }
  })

  it('fitWithin keeps aspect ratio and never upscales', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(100, 50, 1600)).toEqual({ width: 100, height: 50 })
  })
})

/** A 400×150 "key": textured metal with a glare band and a row of dark glyph blocks. */
function keyPhoto(): Pixels {
  return img(400, 150, (x, y) => {
    let v = 150 + ((x * 7 + y * 13) % 11) - 5 // fine texture
    v += Math.max(0, 60 - Math.abs(x - 80) * 2) // glare band on the left
    const inText = y >= 60 && y < 90 && x >= 220 && x < 320 && x % 20 < 12
    if (inText) v -= 70
    return [v, v, v]
  })
}

describe('stamped-number helpers', () => {
  it('boxBlur averages a window', () => {
    const b = boxBlur(
      img(3, 1, (x) => (x === 1 ? [90, 90, 90] : [0, 0, 0])),
      1,
      0,
    )
    expect(px(b, 1, 0)).toBe(30)
  })

  it('normalizeBackground flattens a lighting gradient', () => {
    const lit = img(60, 10, (x) => [60 + x * 3, 60 + x * 3, 60 + x * 3])
    const flat = normalizeBackground(lit, 5)
    expect(Math.abs((px(flat, 10, 5) ?? 0) - (px(flat, 50, 5) ?? 0))).toBeLessThan(8)
  })

  it('otsuBinarize splits a bimodal image', () => {
    const b = otsuBinarize(grayscale(img(10, 1, (x) => (x < 5 ? [40, 40, 40] : [200, 200, 200]))))
    expect(px(b, 0, 0)).toBe(0)
    expect(px(b, 9, 0)).toBe(255)
  })

  it('cropPixels clamps to the image', () => {
    const c = cropPixels(
      img(10, 10, (x) => [x, x, x]),
      { x: 8, y: 0, width: 5, height: 2 },
    )
    expect([c.width, c.height, px(c, 0, 0)]).toEqual([2, 2, 8])
  })

  it('resizeGray scales dimensions and keeps flat values', () => {
    const r = resizeGray(
      img(10, 4, () => [77, 77, 77]),
      25,
      10,
    )
    expect([r.width, r.height, px(r, 12, 5)]).toEqual([25, 10, 77])
  })

  it('locateText finds the glyph row and ignores the glare band', () => {
    const box = locateText(grayscale(keyPhoto()))
    expect(box).not.toBeNull()
    if (!box) return
    expect(box.x).toBeGreaterThan(150)
    expect(box.x + box.width).toBeLessThan(400)
    expect(box.y).toBeLessThanOrEqual(60)
    expect(box.y + box.height).toBeGreaterThanOrEqual(90)
    expect(box.height).toBeLessThan(110)
  })

  it('locateText returns null for a blank image', () => {
    expect(locateText(img(100, 50, () => [128, 128, 128]))).toBeNull()
  })

  it('focusOnText returns an enlarged crop around the text', () => {
    const f = focusOnText(keyPhoto())
    expect(f).not.toBeNull()
    expect(f?.height).toBeGreaterThan(60)
    expect(f?.width).toBeLessThan(400 * 4)
  })

  it('sharpness prefers a crisp edge to a blurred one', () => {
    const crisp = img(40, 40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]))
    const soft = img(40, 40, (x) => {
      const v = Math.max(0, Math.min(255, (x - 10) * 12.75))
      return [v, v, v]
    })
    expect(sharpness(crisp)).toBeGreaterThan(sharpness(soft))
    expect(sharpness(img(10, 10, () => [9, 9, 9]))).toBe(0)
  })
})
