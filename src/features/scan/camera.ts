import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState =
  'idle' | 'starting' | 'ready' | 'denied' | 'unavailable' | 'insecure' | 'error'

/**
 * Rear camera stream bound to a <video>. All tracks are stopped when `active` turns false
 * or the component unmounts (leaving the Scan screen releases the camera).
 */
function supportProblem(): CameraState | null {
  if (!window.isSecureContext) return 'insecure'
  const md = (navigator as { mediaDevices?: MediaDevices }).mediaDevices
  if (!md || typeof md.getUserMedia !== 'function') return 'unavailable'
  return null
}

/** Optional hardware controls the browser exposes for the stream (mostly Android Chrome). */
export interface CameraControls {
  zoom: { min: number; max: number } | null
  torch: boolean
}

interface ExtraCapabilities {
  zoom?: { min?: number; max?: number }
  torch?: boolean
}

function readControls(track: MediaStreamTrack | undefined): CameraControls {
  if (!track || typeof track.getCapabilities !== 'function') return { zoom: null, torch: false }
  const caps = track.getCapabilities() as ExtraCapabilities
  const z = caps.zoom
  return {
    zoom:
      z && typeof z.min === 'number' && typeof z.max === 'number' && z.max > z.min
        ? { min: z.min, max: z.max }
        : null,
    torch: caps.torch === true,
  }
}

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [controls, setControls] = useState<CameraControls | null>(null)
  // Only async outcomes are stored; 'idle'/'starting'/support problems are derived.
  const [outcome, setOutcome] = useState<CameraState | null>(null)
  const problem = active ? supportProblem() : null

  useEffect(() => {
    if (!active || supportProblem()) return
    const flag = { cancelled: false }
    let stream: MediaStream | null = null
    const video = videoRef.current
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      .then(async (s) => {
        if (flag.cancelled) {
          s.getTracks().forEach((t) => {
            t.stop()
          })
          return
        }
        stream = s
        const track = s.getVideoTracks()[0]
        trackRef.current = track ?? null
        // Keep refocusing as the key moves (ignored where unsupported, e.g. iOS).
        void track
          ?.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          })
          .catch(() => undefined)
        setControls(readControls(track))
        if (video) {
          video.srcObject = s
          video.muted = true
          video.playsInline = true
          await video.play().catch(() => undefined)
        }
        setOutcome('ready')
      })
      .catch((e: unknown) => {
        if (flag.cancelled) return
        const name = e instanceof DOMException ? e.name : ''
        setOutcome(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'unavailable'
              : 'error',
        )
      })
    return () => {
      flag.cancelled = true
      stream?.getTracks().forEach((t) => {
        t.stop()
      })
      if (video) video.srcObject = null
      trackRef.current = null
      setOutcome(null)
      setControls(null)
    }
  }, [active])

  const setZoom = useCallback((zoom: number) => {
    void trackRef.current
      ?.applyConstraints({ advanced: [{ zoom } as unknown as MediaTrackConstraintSet] })
      .catch(() => undefined)
  }, [])
  const setTorch = useCallback((on: boolean) => {
    void trackRef.current
      ?.applyConstraints({ advanced: [{ torch: on } as unknown as MediaTrackConstraintSet] })
      .catch(() => undefined)
  }, [])

  const state: CameraState = !active ? 'idle' : (problem ?? outcome ?? 'starting')
  return { videoRef, state, controls: state === 'ready' ? controls : null, setZoom, setTorch }
}

export const CAMERA_MESSAGES: Record<
  Exclude<CameraState, 'idle' | 'starting' | 'ready'>,
  string
> = {
  denied:
    'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.',
  unavailable: 'No camera was found on this device.',
  insecure: 'The camera needs a secure (https) connection.',
  error: 'The camera could not be started. Close other apps using it and try again.',
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Maps a centered guide box (fractions of the visible container) to source-video pixels,
 * for a <video> rendered with `object-fit: cover`.
 */
export function guideCropRect(
  videoW: number,
  videoH: number,
  boxW: number,
  boxH: number,
  guideFracW: number,
  guideFracH: number,
): Rect {
  const scale = Math.max(boxW / videoW, boxH / videoH) // cover
  const visibleW = boxW / scale
  const visibleH = boxH / scale
  const width = visibleW * guideFracW
  const height = visibleH * guideFracH
  return {
    x: Math.round((videoW - width) / 2),
    y: Math.round((videoH - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  }
}
