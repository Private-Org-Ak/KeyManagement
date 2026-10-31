import { useState } from 'react'
import { Banner, Button, Sheet } from '@/components/ui'
import type { OcrCandidate } from '@/lib/match'
import { OcrCapture } from './ocr/OcrCapture'

/** Reads a number with the camera and hands it back (used by the key form). */
export function ScanNumberSheet({
  open,
  onClose,
  onRead,
}: {
  open: boolean
  onClose: () => void
  onRead: (text: string) => void
}) {
  const [cands, setCands] = useState<OcrCandidate[] | null>(null)
  const close = () => {
    setCands(null)
    onClose()
  }
  const sorted = [...(cands ?? [])]
    .sort((a, b) => b.text.length - a.text.length || b.confidence - a.confidence)
    .slice(0, 4)

  return (
    <Sheet open={open} onClose={close} title="Read key number">
      {open && cands === null && (
        <OcrCapture
          active
          isDone={(c) => c.some((x) => x.confidence >= 85)}
          onResult={(run) => {
            setCands(run.candidates)
          }}
        />
      )}
      {cands !== null && (
        <div className="flex flex-col gap-3">
          {sorted.length === 0 ? (
            <Banner tone="warning">
              Couldn’t read a number. Try again with more light, or type it.
            </Banner>
          ) : (
            <>
              <p className="font-medium">Tap the correct number:</p>
              {sorted.map((c) => (
                <Button
                  key={c.text}
                  variant="secondary"
                  size="lg"
                  className="font-mono"
                  onClick={() => {
                    setCands(null)
                    onRead(c.text)
                  }}
                >
                  {c.text}
                </Button>
              ))}
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setCands(null)
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </Sheet>
  )
}
