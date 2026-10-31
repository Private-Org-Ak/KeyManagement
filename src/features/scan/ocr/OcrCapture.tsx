import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, Spinner, cx } from '@/components/ui'
import { readPixels, sharpness, type Pixels } from '@/lib/image'
import type { OcrCandidate } from '@/lib/match'
import { guideCropRect, useCamera } from '../camera'
import { CameraView, NUMBER_GUIDE } from '../CameraView'
import { preloadOcr, readNumber, type OcrRun } from './ocr'

/** Upper bound for the crop width; the OCR step finds the digits and crops tighter itself. */
const MAX_WIDTH = 1600
/** Frames grabbed per tap; the sharpest wins (tapping the button shakes the phone). */
const FRAMES = 4
const FRAME_GAP_MS = 110
const ZOOM_STEPS = [1, 2, 3]

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Camera with a guide box; tap to capture → crop to the box → on-device OCR.
 * Also accepts a photo from the library (handy on desktop and for old photos).
 */
export function OcrCapture({
  active,
  isDone,
  onResult,
}: {
  active: boolean
  isDone: (c: OcrCandidate[]) => boolean
  onResult: (run: OcrRun, crop: Pixels) => void
}) {
  const { videoRef, state, controls, setZoom, setTorch } = useCamera(active)
  const [busy, setBusy] = useState(false)
  const [zoom, setZoomLevel] = useState<number | null>(null)
  const [torch, setTorchOn] = useState(false)
  const zoomSteps = controls?.zoom
    ? ZOOM_STEPS.filter((z) => controls.zoom && z >= controls.zoom.min && z <= controls.zoom.max)
    : []
  // Default to 2× where the camera supports it: small stamped digits get bigger while the
  // phone stays far enough away to focus.
  const effectiveZoom = zoom ?? (zoomSteps.includes(2) ? 2 : null)

  useEffect(() => {
    if (controls?.zoom && effectiveZoom !== null) setZoom(effectiveZoom)
  }, [controls, effectiveZoom, setZoom])
  const [failed, setFailed] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) preloadOcr()
  }, [active])

  const run = async (crop: Pixels) => {
    setBusy(true)
    setFailed(false)
    try {
      onResult(await readNumber(crop, isDone), crop)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const grabFrame = (v: HTMLVideoElement): Pixels => {
    const r = guideCropRect(
      v.videoWidth,
      v.videoHeight,
      v.clientWidth,
      v.clientHeight,
      NUMBER_GUIDE.w,
      NUMBER_GUIDE.h,
    )
    return readPixels(v, r.x, r.y, r.width, r.height, Math.min(MAX_WIDTH, r.width))
  }

  const capture = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setBusy(true)
    let best: Pixels | null = null
    let bestScore = -1
    for (let i = 0; i < FRAMES; i++) {
      if (i > 0) await wait(FRAME_GAP_MS)
      const frame = grabFrame(v)
      const score = sharpness(frame)
      if (score > bestScore) {
        best = frame
        bestScore = score
      }
    }
    if (best) await run(best)
    else setBusy(false)
  }

  const fromFile = async (f: File) => {
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
    try {
      await run(readPixels(bmp, 0, 0, bmp.width, bmp.height, Math.min(MAX_WIDTH, bmp.width)))
    } finally {
      bmp.close()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CameraView
        videoRef={videoRef}
        state={state}
        guide={NUMBER_GUIDE}
        hint="Fill the box with the stamped number"
      >
        {(zoomSteps.length > 1 || controls?.torch) && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {zoomSteps.length > 1 &&
              zoomSteps.map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={effectiveZoom === z}
                  aria-label={`Zoom ${String(z)}×`}
                  onClick={() => {
                    setZoomLevel(z)
                  }}
                  className={cx(
                    'size-11 rounded-full text-sm font-bold backdrop-blur transition',
                    effectiveZoom === z ? 'bg-white text-slate-900' : 'bg-black/50 text-white',
                  )}
                >
                  {z}×
                </button>
              ))}
            {controls?.torch && (
              <button
                type="button"
                aria-pressed={torch}
                aria-label="Light"
                onClick={() => {
                  setTorch(!torch)
                  setTorchOn(!torch)
                }}
                className={cx(
                  'flex size-11 items-center justify-center rounded-full backdrop-blur transition',
                  torch ? 'bg-amber-300 text-slate-900' : 'bg-black/50 text-white',
                )}
              >
                <Icon name="bolt" className="size-5" />
              </button>
            )}
          </div>
        )}
        {busy && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white"
            role="status"
          >
            <Spinner label="Reading the number…" />
          </div>
        )}
      </CameraView>
      {failed && (
        <Banner tone="error">
          Couldn’t run text recognition. Check your connection the first time you scan, then try
          again.
        </Banner>
      )}
      <Button
        size="lg"
        onClick={() => {
          void capture()
        }}
        disabled={state !== 'ready' || busy}
        aria-label="Read number from the camera"
      >
        Read number
      </Button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a photo of the key"
        data-testid="ocr-file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void fromFile(f)
          e.target.value = ''
        }}
      />
      <Button variant="ghost" disabled={busy} onClick={() => file.current?.click()}>
        Use a photo instead
      </Button>
    </div>
  )
}
