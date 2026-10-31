import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Banner, Button, SelectField, TextArea, TextField } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { DOOR_TYPES, DOOR_TYPE_LABEL, type DoorRow } from '@/types/models'
import {
  doorSchema,
  roomWithWashroomSchema,
  washroomName,
  type DoorFormIn,
  type DoorFormOut,
  type RoomFormIn,
  type RoomFormOut,
} from './schemas'

export function DoorForm({
  initial,
  submitLabel,
  pending,
  error,
  disabled,
  onSubmit,
}: {
  initial?: DoorRow
  submitLabel: string
  pending: boolean
  error: unknown
  disabled?: boolean
  onSubmit: (v: DoorFormOut) => void
}) {
  const { register, handleSubmit, formState } = useForm<DoorFormIn, unknown, DoorFormOut>({
    resolver: zodResolver(doorSchema),
    defaultValues: {
      name: initial?.name ?? '',
      room_group: initial?.room_group ?? '',
      floor: initial?.floor ?? '',
      door_type: initial?.door_type ?? 'room',
      notes: initial?.notes ?? '',
    },
  })
  const e = formState.errors
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        void handleSubmit(onSubmit)(ev)
      }}
    >
      <TextField
        label="Door name"
        placeholder="e.g. Kids Room"
        autoFocus={!initial}
        error={e.name?.message}
        {...register('name')}
      />
      <SelectField label="Type" {...register('door_type')}>
        {DOOR_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOOR_TYPE_LABEL[t]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Room group"
          placeholder="e.g. Kids Room"
          error={e.room_group?.message}
          {...register('room_group')}
        />
        <TextField
          label="Floor"
          placeholder="e.g. First"
          error={e.floor?.message}
          {...register('floor')}
        />
      </div>
      <TextArea
        label="Notes"
        placeholder="Optional"
        error={e.notes?.message}
        {...register('notes')}
      />
      {!!error && <Banner tone="error">{errorMessage(error)}</Banner>}
      <Button type="submit" size="lg" loading={pending} disabled={disabled}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function RoomWithWashroomForm({
  pending,
  error,
  disabled,
  onSubmit,
}: {
  pending: boolean
  error: unknown
  disabled?: boolean
  onSubmit: (v: RoomFormOut) => void
}) {
  const { register, handleSubmit, formState, control } = useForm<RoomFormIn, unknown, RoomFormOut>({
    resolver: zodResolver(roomWithWashroomSchema),
    defaultValues: { room: '', floor: '' },
  })
  const room = useWatch({ control, name: 'room' }).trim()
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        void handleSubmit(onSubmit)(ev)
      }}
    >
      <TextField
        label="Room name"
        placeholder="e.g. Master Bedroom"
        autoFocus
        error={formState.errors.room?.message}
        {...register('room')}
      />
      <TextField
        label="Floor"
        placeholder="Optional"
        error={formState.errors.floor?.message}
        {...register('floor')}
      />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Creates two doors: <strong>{room || 'Room'}</strong> and{' '}
        <strong>{washroomName(room || 'Room')}</strong>.
      </p>
      {!!error && <Banner tone="error">{errorMessage(error)}</Banner>}
      <Button type="submit" size="lg" loading={pending} disabled={disabled}>
        Add both doors
      </Button>
    </form>
  )
}
