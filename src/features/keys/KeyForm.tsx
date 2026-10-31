import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Banner, Button, SelectField, TextField } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import type { DoorRow } from '@/types/models'
import { ScanNumberSheet } from '@/features/scan/ScanNumberSheet'
import { keySchema, type KeyFormIn, type KeyFormOut } from './schemas'

export function KeyForm({
  doors,
  defaults,
  submitLabel,
  pending,
  error,
  disabled,
  onSubmit,
  extra,
}: {
  doors: readonly DoorRow[]
  defaults: KeyFormIn
  submitLabel: string
  pending: boolean
  error: unknown
  disabled?: boolean
  onSubmit: (v: KeyFormOut) => void
  extra?: ReactNode
}) {
  const { register, handleSubmit, formState, setValue } = useForm<KeyFormIn, unknown, KeyFormOut>({
    resolver: zodResolver(keySchema),
    defaultValues: defaults,
  })
  const [scanning, setScanning] = useState(false)
  const e = formState.errors
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        void handleSubmit(onSubmit)(ev)
      }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="Key number"
            placeholder="As stamped on the key"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus={!defaults.key_number}
            className="font-mono text-lg"
            error={e.key_number?.message}
            {...register('key_number')}
          />
        </div>
        <Button
          variant="secondary"
          className={e.key_number ? 'mb-7' : ''}
          aria-label="Scan the key number with the camera"
          onClick={() => {
            setScanning(true)
          }}
        >
          Scan
        </Button>
      </div>
      <SelectField label="Door" error={e.door_id?.message} {...register('door_id')}>
        <option value="">— Not assigned —</option>
        {doors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Label"
          placeholder="e.g. Copy 1"
          error={e.label?.message}
          {...register('label')}
        />
        <TextField
          label="Who has it"
          placeholder="e.g. Cleaner"
          error={e.holder?.message}
          {...register('holder')}
        />
      </div>
      {!!error && <Banner tone="error">{errorMessage(error)}</Banner>}
      <Button type="submit" size="lg" loading={pending} disabled={disabled}>
        {submitLabel}
      </Button>
      {extra}
      <ScanNumberSheet
        open={scanning}
        onClose={() => {
          setScanning(false)
        }}
        onRead={(text) => {
          setValue('key_number', text, { shouldValidate: true, shouldDirty: true })
          setScanning(false)
        }}
      />
    </form>
  )
}
