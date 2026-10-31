/** Web NFC — Chrome on Android only. Always feature-detect; hide NFC UI elsewhere. */
interface NDEFReadingEventLike extends Event {
  serialNumber: string
}
interface NDEFReaderLike extends EventTarget {
  scan(opts?: { signal?: AbortSignal }): Promise<void>
}

export function isNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

export type NfcError = 'unsupported' | 'denied' | 'error'

/**
 * Starts listening for tags (must be called from a user gesture). Calls onSerial for each
 * tag read. Abort the signal to stop.
 */
export async function startNfcScan(
  onSerial: (serial: string) => void,
  signal: AbortSignal,
): Promise<NfcError | null> {
  if (!isNfcSupported()) return 'unsupported'
  const Ctor = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader
  const reader = new Ctor()
  // Listen before scanning so no early read is missed.
  reader.addEventListener(
    'reading',
    (ev) => {
      const serial = (ev as NDEFReadingEventLike).serialNumber
      if (serial) onSerial(serial)
    },
    { signal },
  )
  try {
    await reader.scan({ signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    return e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'error'
  }
  return null
}
