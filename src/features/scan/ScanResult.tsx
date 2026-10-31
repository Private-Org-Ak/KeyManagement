import { useState } from 'react'
import { Banner, Button, TextField } from '@/components/ui'
import type { ScanMatch } from '@/lib/match'
import type { DoorRow, KeyRow } from '@/types/models'
import { DoorResultCard } from '@/features/search/DoorResultCard'

/** "I read: …" + exact hit (shown directly) or top-3 fuzzy hits (tap to pick); editable. */
export function ScanResult({
  hid,
  match,
  onRetry,
  onEdit,
  extra,
}: {
  hid: string
  match: ScanMatch<KeyRow, DoorRow>
  onRetry: () => void
  onEdit: (text: string) => void
  extra?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(match.read ?? '')

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <p>
          <span className="text-sm text-slate-600 dark:text-slate-400">I read: </span>
          <span className="font-mono text-xl font-semibold" data-testid="ocr-read">
            {match.read ?? 'nothing'}
          </span>
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing((e) => !e)
          }}
        >
          Edit
        </Button>
      </div>
      {editing && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onEdit(text)
            setEditing(false)
          }}
        >
          <div className="flex-1">
            <TextField
              label="Key number"
              value={text}
              autoFocus
              autoCapitalize="characters"
              className="font-mono"
              onChange={(e) => {
                setText(e.target.value)
              }}
            />
          </div>
          <Button type="submit">Look up</Button>
        </form>
      )}

      {match.exact.length > 0 ? (
        <>
          {match.exact.length > 1 && (
            <p className="font-medium">This number opens {match.exact.length} doors:</p>
          )}
          {match.exact.map((g, i) => (
            <DoorResultCard key={g.door?.id ?? 'none'} hid={hid} group={g} highlight={i === 0} />
          ))}
        </>
      ) : match.fuzzy.length > 0 ? (
        <>
          <p className="font-medium">Not sure — is it one of these?</p>
          {match.fuzzy.map((g) => (
            <DoorResultCard key={g.door?.id ?? 'none'} hid={hid} group={g} />
          ))}
        </>
      ) : (
        <Banner tone="warning">
          No key with that number. Try again closer, with more light, or edit the number.
        </Banner>
      )}
      {extra}
      <Button variant="secondary" size="lg" onClick={onRetry}>
        Scan again
      </Button>
    </div>
  )
}
