import { describe, expect, it } from 'vitest'
import { guideCropRect } from './camera'

describe('guideCropRect', () => {
  it('maps a centered guide on a portrait box over a landscape video (cover)', () => {
    // 1920x1080 video in a 360x480 box → scale = 480/1080; visible width = 810px of video.
    const r = guideCropRect(1920, 1080, 360, 480, 0.8, 0.25)
    expect(r.width).toBe(648)
    expect(r.height).toBe(270)
    expect(r.x).toBe(636)
    expect(r.y).toBe(405)
  })

  it('covers the full frame when the guide is 100%', () => {
    expect(guideCropRect(1000, 1000, 500, 500, 1, 1)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    })
  })
})
