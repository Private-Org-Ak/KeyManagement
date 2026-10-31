/**
 * QR decoding from a playing <video>. Native BarcodeDetector where available
 * (Android Chrome), else lazy-loaded @zxing/browser (iOS Safari). Polls a few frames per
 * second and calls `onText` for each decoded payload.
 */
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

async function nativeDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code']
    if (!formats.includes('qr_code')) return null
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

type FrameDecoder = (video: HTMLVideoElement) => Promise<string | null>

async function makeDecoder(): Promise<FrameDecoder> {
  const native = await nativeDetector()
  if (native) {
    return async (video) => {
      const codes = await native.detect(video)
      return codes[0]?.rawValue ?? null
    }
  }
  const { BrowserQRCodeReader } = await import('@zxing/browser')
  const reader = new BrowserQRCodeReader()
  const canvas = document.createElement('canvas')
  return (video) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return Promise.resolve(null)
    const scale = Math.min(1, 1000 / Math.max(w, h))
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    canvas
      .getContext('2d', { willReadFrequently: true })
      ?.drawImage(video, 0, 0, canvas.width, canvas.height)
    try {
      return Promise.resolve(reader.decodeFromCanvas(canvas).getText())
    } catch {
      return Promise.resolve(null) // no code in this frame
    }
  }
}

/** Starts scanning; returns a stop function. */
export function startQrScan(
  video: HTMLVideoElement,
  onText: (text: string) => void,
  intervalMs = 250,
): () => void {
  const state = { stopped: false }
  const isStopped = () => state.stopped
  let timer: ReturnType<typeof setTimeout> | undefined
  void makeDecoder().then((decode) => {
    const tick = async () => {
      if (state.stopped) return
      if (video.readyState >= 2) {
        try {
          const text = await decode(video)
          if (text && !isStopped()) onText(text)
        } catch {
          // transient decode error — keep scanning
        }
      }
      if (!isStopped()) timer = setTimeout(() => void tick(), intervalMs)
    }
    void tick()
  })
  return () => {
    state.stopped = true
    if (timer) clearTimeout(timer)
  }
}
