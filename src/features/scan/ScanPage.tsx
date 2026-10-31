import { useCallback, useMemo, useState } from 'react'
import { Banner, Button, PageHeader, cx } from '@/components/ui'
import { flags } from '@/lib/flags'
import type { Pixels } from '@/lib/image'
import { canonical } from '@/lib/normalize'
import { matchScanned, type OcrCandidate, type ScanMatch } from '@/lib/match'
import { nfcTagId, parseQrPayload } from '@/lib/tags'
import { errorMessage } from '@/lib/errors'
import type { DoorRow, KeyRow } from '@/types/models'
import { useDoors } from '@/features/doors/api'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { findKeyByTag, useKeys } from '@/features/keys/api'
import { DoorResultCard } from '@/features/search/DoorResultCard'
import { useTryHarder } from './llm'
import { isNfcSupported } from './nfc/nfc'
import { NfcPanel } from './nfc/NfcPanel'
import { OcrCapture } from './ocr/OcrCapture'
import { QrPanel } from './qr/QrPanel'
import { ScanResult } from './ScanResult'

type Tab = 'number' | 'qr' | 'nfc'
type TagResult = { kind: 'found'; key: KeyRow } | { kind: 'unknown' } | { kind: 'foreign' }

export function ScanPage() {
  const { hid, online } = useCurrentHousehold()
  const doorRows = useDoors(hid)
  const keyRows = useKeys(hid)
  const doors = useMemo(() => doorRows ?? [], [doorRows])
  const keys = useMemo(() => keyRows ?? [], [keyRows])
  const [tab, setTab] = useState<Tab>('number')
  const [match, setMatch] = useState<ScanMatch<KeyRow, DoorRow> | null>(null)
  const [crop, setCrop] = useState<Pixels | null>(null)
  const [ms, setMs] = useState<number | null>(null)
  const [tag, setTag] = useState<TagResult | null>(null)
  const tryHarder = useTryHarder(hid)
  const nfc = isNfcSupported()

  const keyCanon = useMemo(() => new Set(keys.map((k) => canonical(k.key_number))), [keys])
  const isDone = useCallback(
    (c: OcrCandidate[]) => c.some((x) => keyCanon.has(canonical(x.text))),
    [keyCanon],
  )

  const onTag = async (tagId: string | null) => {
    if (!tagId) {
      setTag({ kind: 'foreign' })
      return
    }
    const key = await findKeyByTag(hid, tagId)
    setTag(key ? { kind: 'found', key } : { kind: 'unknown' })
  }

  const reset = () => {
    setMatch(null)
    setCrop(null)
    setTag(null)
    setMs(null)
    tryHarder.reset()
  }
  const tabs: { id: Tab; label: string }[] = [
    { id: 'number', label: 'Number' },
    { id: 'qr', label: 'QR tag' },
    ...(nfc ? [{ id: 'nfc' as const, label: 'NFC' }] : []),
  ]
  const tagGroup =
    tag?.kind === 'found'
      ? { door: doors.find((d) => d.id === tag.key.door_id) ?? null, keys: [tag.key], score: 0 }
      : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Scan" back={`/h/${hid}`} />
      <div
        role="tablist"
        aria-label="Scan mode"
        className={`grid rounded-2xl bg-slate-200/70 p-1 dark:bg-white/5 ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              reset()
              setTab(t.id)
            }}
            className={cx(
              'min-h-11 rounded-xl text-sm font-bold transition',
              tab === t.id
                ? 'bg-white text-brand-700 shadow-card dark:bg-surface-dark-2 dark:text-brand-200'
                : 'text-slate-600 dark:text-slate-400',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'number' &&
        (match ? (
          <>
            <ScanResult
              hid={hid}
              match={match}
              onRetry={reset}
              onEdit={(text) => {
                setMatch(matchScanned([{ text, confidence: 100 }], keys, doors))
              }}
              extra={
                flags.llmFallback &&
                match.exact.length === 0 &&
                crop &&
                online && (
                  <>
                    {tryHarder.isError && (
                      <Banner tone="error">{errorMessage(tryHarder.error)}</Banner>
                    )}
                    <Button
                      variant="secondary"
                      loading={tryHarder.isPending}
                      onClick={() => {
                        tryHarder.mutate(crop, {
                          onSuccess: (cands) => {
                            setMatch(matchScanned(cands, keys, doors))
                          },
                        })
                      }}
                    >
                      Try harder
                    </Button>
                  </>
                )
              }
            />
            {ms !== null && (
              <p className="text-center text-xs text-slate-600 dark:text-slate-400">
                Read in {(ms / 1000).toFixed(1)} s
              </p>
            )}
          </>
        ) : (
          <OcrCapture
            active
            isDone={isDone}
            onResult={(run, c) => {
              setCrop(c)
              setMs(run.ms)
              setMatch(matchScanned(run.candidates, keys, doors))
            }}
          />
        ))}

      {tab === 'qr' &&
        (tag ? (
          <TagOutcome hid={hid} tag={tag} group={tagGroup} onRetry={reset} />
        ) : (
          <QrPanel active onText={(t) => void onTag(parseQrPayload(t))} />
        ))}

      {tab === 'nfc' &&
        (tag ? (
          <TagOutcome hid={hid} tag={tag} group={tagGroup} onRetry={reset} />
        ) : (
          <NfcPanel onSerial={(s) => void onTag(nfcTagId(s))} />
        ))}
    </div>
  )
}

function TagOutcome({
  hid,
  tag,
  group,
  onRetry,
}: {
  hid: string
  tag: TagResult
  group: { door: DoorRow | null; keys: KeyRow[]; score: number } | null
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {tag.kind === 'found' && group ? (
        <DoorResultCard hid={hid} group={group} highlight />
      ) : tag.kind === 'unknown' ? (
        <Banner tone="warning">
          This tag isn’t assigned to a key yet. Open a key and choose “Assign tag”.
        </Banner>
      ) : (
        <Banner tone="warning">That isn’t a KeyFinder tag.</Banner>
      )}
      <Button variant="secondary" size="lg" onClick={onRetry}>
        Scan again
      </Button>
    </div>
  )
}
