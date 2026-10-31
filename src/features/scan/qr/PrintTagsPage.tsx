import { useEffect, useState } from 'react'
import { Button, PageHeader, SelectField, Spinner } from '@/components/ui'
import { newQrTagId, tagShortLabel } from '@/lib/tags'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'

interface Tag {
  id: string
  svg: string
}

const COUNTS = [12, 24, 48] as const

/**
 * A4 sheet of random `kf1:` QR tags. Tags hold no household info and aren't stored until
 * assigned to a key, so printing extras is harmless.
 */
export function PrintTagsPage() {
  const { hid } = useCurrentHousehold()
  const [count, setCount] = useState<number>(24)
  const [seed, setSeed] = useState(0)
  const [generated, setGenerated] = useState<{ key: string; tags: Tag[] } | null>(null)
  const genKey = `${count}:${seed}`
  const tags = generated?.key === genKey ? generated.tags : null

  useEffect(() => {
    const flag = { cancelled: false }
    void (async () => {
      const QR = await import('qrcode')
      const out: Tag[] = []
      for (let i = 0; i < count; i++) {
        const id = newQrTagId()
        const svg = await QR.toString(id, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
        })
        out.push({ id, svg })
      }
      if (!flag.cancelled) setGenerated({ key: `${count}:${seed}`, tags: out })
    })()
    return () => {
      flag.cancelled = true
    }
  }, [count, seed])

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader title="Print QR tags" back={`/h/${hid}/settings`} />
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          Print on A4 (sticker paper works best), cut out, and stick one on each key ring. Then open
          a key and tap <strong>Assign tag</strong> to link it.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SelectField
              label="Number of tags"
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value))
              }}
            >
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setSeed((s) => s + 1)
            }}
          >
            New codes
          </Button>
          <Button
            onClick={() => {
              window.print()
            }}
            disabled={!tags}
          >
            Print
          </Button>
        </div>
      </div>
      {!tags ? (
        <Spinner label="Generating tags…" />
      ) : (
        <ul
          className="print-sheet grid grid-cols-3 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-2"
          aria-label="QR tags"
        >
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-2 text-slate-900 break-inside-avoid"
            >
              <div
                className="w-full [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: t.svg }}
              />
              <span className="font-mono text-xs tracking-widest">{tagShortLabel(t.id)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
