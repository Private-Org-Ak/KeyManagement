import { useEffect, useRef, useState } from 'react'
import { Banner, Button } from '@/components/ui'
import { startNfcScan, type NfcError } from './nfc'

const MESSAGES: Record<NfcError, string> = {
  unsupported: 'NFC isn’t available on this device.',
  denied: 'NFC permission was denied. Allow it in site settings and try again.',
  error: 'Couldn’t start NFC. Make sure NFC is turned on in your phone settings.',
}

/** Android Chrome only. Scanning must start from a tap (user gesture). */
export function NfcPanel({ onSerial }: { onSerial: (serial: string) => void }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<NfcError | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abort.current?.abort()
    },
    [],
  )

  const start = async () => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setError(null)
    const err = await startNfcScan(onSerial, ac.signal)
    if (err) setError(err)
    else setListening(true)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div
        className={`flex size-32 items-center justify-center rounded-full ${listening ? 'animate-pulse bg-brand-400/30' : 'bg-slate-200 dark:bg-slate-800'}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M6 8.5a8 8 0 0 1 0 7M9.5 6a12 12 0 0 1 0 12M13 4a16 16 0 0 1 0 16" />
        </svg>
      </div>
      {listening ? (
        <p role="status" className="text-lg">
          Hold the key’s NFC tag against the back of your phone.
        </p>
      ) : (
        <Button size="lg" onClick={() => void start()}>
          Start NFC scan
        </Button>
      )}
      {error && <Banner tone="error">{MESSAGES[error]}</Banner>}
    </div>
  )
}
