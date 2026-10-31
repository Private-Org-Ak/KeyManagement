import { useState } from 'react'
import { Banner, Sheet, cx } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { nfcTagId, parseQrPayload } from '@/lib/tags'
import { isNfcSupported } from './nfc/nfc'
import { NfcPanel } from './nfc/NfcPanel'
import { QrPanel } from './qr/QrPanel'

/** Scan a QR (or NFC on Android) tag to assign it to a key. */
export function TagScanSheet({
  open,
  onClose,
  onTag,
  pending,
  error,
}: {
  open: boolean
  onClose: () => void
  onTag: (tagId: string) => void
  pending: boolean
  error: unknown
}) {
  const nfc = isNfcSupported()
  const [mode, setMode] = useState<'qr' | 'nfc'>('qr')
  const [foreign, setForeign] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} title="Assign a tag">
      <div className="flex flex-col gap-3">
        {nfc && (
          <div
            role="tablist"
            aria-label="Tag type"
            className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1 dark:bg-white/5"
          >
            {(['qr', 'nfc'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                }}
                className={cx(
                  'min-h-11 rounded-xl text-sm font-bold transition',
                  mode === m
                    ? 'bg-white text-brand-700 shadow-card dark:bg-surface-dark-2 dark:text-brand-200'
                    : 'text-slate-600 dark:text-slate-400',
                )}
              >
                {m === 'qr' ? 'QR tag' : 'NFC tag'}
              </button>
            ))}
          </div>
        )}
        {open && mode === 'qr' && (
          <QrPanel
            active={!pending}
            onText={(text) => {
              const id = parseQrPayload(text)
              setForeign(!id)
              if (id) onTag(id)
            }}
          />
        )}
        {open && mode === 'nfc' && (
          <NfcPanel
            onSerial={(s) => {
              const id = nfcTagId(s)
              if (id) onTag(id)
            }}
          />
        )}
        {foreign && (
          <Banner tone="warning">
            That isn’t a KeyFinder tag. Print tags from Settings → Print QR tags.
          </Banner>
        )}
        {pending && <Banner tone="info">Saving…</Banner>}
        {!!error && <Banner tone="error">{errorMessage(error)}</Banner>}
      </div>
    </Sheet>
  )
}
