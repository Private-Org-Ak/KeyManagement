import { useEffect, useRef } from 'react'
import { useCamera } from '../camera'
import { CameraView, QR_GUIDE } from '../CameraView'
import { startQrScan } from './decoder'

/** Continuously decodes QR codes while active; calls onText once per distinct payload. */
export function QrPanel({
  active,
  onText,
  hint = 'Point at the QR tag on the key ring',
}: {
  active: boolean
  onText: (text: string) => void
  hint?: string
}) {
  const { videoRef, state } = useCamera(active)
  const last = useRef<{ text: string; at: number } | null>(null)
  const cb = useRef(onText)
  useEffect(() => {
    cb.current = onText
  }, [onText])

  useEffect(() => {
    const v = videoRef.current
    if (!active || state !== 'ready' || !v) return
    return startQrScan(v, (text) => {
      const now = Date.now()
      if (last.current && last.current.text === text && now - last.current.at < 2500) return
      last.current = { text, at: now }
      ;(navigator as { vibrate?: (ms: number) => boolean }).vibrate?.(30)
      cb.current(text)
    })
  }, [active, state, videoRef])

  return <CameraView videoRef={videoRef} state={state} guide={QR_GUIDE} hint={hint} />
}
