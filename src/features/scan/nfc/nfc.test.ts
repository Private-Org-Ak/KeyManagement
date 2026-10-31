import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNfcSupported, startNfcScan } from './nfc'

describe('nfc feature detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as Record<string, unknown>).NDEFReader
  })

  it('is unsupported without NDEFReader (iOS, desktop)', async () => {
    expect(isNfcSupported()).toBe(false)
    expect(await startNfcScan(() => undefined, new AbortController().signal)).toBe('unsupported')
  })

  it('reports serial numbers from reading events', async () => {
    class FakeReader extends EventTarget {
      scan() {
        queueMicrotask(() => {
          const ev = Object.assign(new Event('reading'), { serialNumber: '04:a2:3b' })
          this.dispatchEvent(ev)
        })
        return Promise.resolve()
      }
    }
    ;(window as unknown as Record<string, unknown>).NDEFReader = FakeReader
    expect(isNfcSupported()).toBe(true)
    const seen: string[] = []
    const ac = new AbortController()
    expect(await startNfcScan((s) => seen.push(s), ac.signal)).toBeNull()
    await Promise.resolve()
    expect(seen).toEqual(['04:a2:3b'])
    ac.abort()
  })

  it('maps a permission error', async () => {
    ;(window as unknown as Record<string, unknown>).NDEFReader = class {
      scan() {
        return Promise.reject(new DOMException('no', 'NotAllowedError'))
      }
      addEventListener() {
        return undefined
      }
    }
    expect(await startNfcScan(() => undefined, new AbortController().signal)).toBe('denied')
  })
})
