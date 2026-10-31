import type { ReactNode, RefObject } from 'react'
import { Banner, Spinner } from '@/components/ui'
import { CAMERA_MESSAGES, type CameraState } from './camera'

export const NUMBER_GUIDE = { w: 0.8, h: 0.2 } as const
export const QR_GUIDE = { w: 0.7, h: 0.7 } as const

/** Live camera preview with a guide rectangle overlay. */
export function CameraView({
  videoRef,
  state,
  guide,
  hint,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  state: CameraState
  guide: { w: number; h: number }
  hint: string
  children?: ReactNode
}) {
  if (state !== 'idle' && state !== 'starting' && state !== 'ready') {
    return <Banner tone="error">{CAMERA_MESSAGES[state]}</Banner>
  }
  return (
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black"
      data-testid="camera"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-brand-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{ width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }}
      />
      <p className="absolute inset-x-0 top-3 px-4 text-center text-sm font-medium text-white drop-shadow">
        {hint}
      </p>
      {state !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Spinner label="Starting camera…" />
        </div>
      )}
      {children}
    </div>
  )
}
