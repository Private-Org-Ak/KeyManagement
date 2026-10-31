import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import {
  Banner,
  Button,
  Card,
  LinkButton,
  PageHeader,
  Sheet,
  TextField,
  CardHeader,
} from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { can } from '@/lib/roles'
import { useUserId } from '@/features/auth/AuthProvider'
import { useDeleteHousehold, useRenameHousehold } from './api'
import { useCurrentHousehold } from './HouseholdContext'
import { householdName } from './schemas'

const renameSchema = z.object({ name: householdName })

export function SettingsPage() {
  const { hid, household, online } = useCurrentHousehold()
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Home settings" subtitle={household.name} />

      {can(household.role, 'rename') && <RenameCard key={household.name} />}

      <Card className="flex flex-col gap-3">
        <CardHeader icon="printer" title="QR key tags" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Print a sheet of QR stickers, stick one on each key ring, then assign it on the key’s
          page. Scanning a tag shows its door instantly.
        </p>
        <LinkButton to={`/h/${hid}/settings/tags`} variant="secondary">
          Print QR tags
        </LinkButton>
      </Card>

      {can(household.role, 'delete-household') && (
        <Card className="flex flex-col gap-3 border-red-200 dark:border-red-900">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Delete home</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Permanently deletes this home with all its doors, keys, photos and members. This can’t
            be undone.
          </p>
          <Button
            variant="danger"
            disabled={!online}
            onClick={() => {
              setDeleting(true)
            }}
          >
            Delete home…
          </Button>
        </Card>
      )}

      <DeleteSheet
        open={deleting}
        onClose={() => {
          setDeleting(false)
        }}
      />
    </div>
  )
}

function RenameCard() {
  const { hid, household, online } = useCurrentHousehold()
  const userId = useUserId()
  const rename = useRenameHousehold(hid, userId)
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof renameSchema>,
    unknown,
    z.output<typeof renameSchema>
  >({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: household.name },
  })
  return (
    <Card>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          void handleSubmit(({ name }) => {
            rename.mutate(name)
          })(e)
        }}
      >
        <TextField label="Home name" error={formState.errors.name?.message} {...register('name')} />
        {rename.isError && <Banner tone="error">{errorMessage(rename.error)}</Banner>}
        {rename.isSuccess && <Banner tone="success">Saved.</Banner>}
        <Button
          type="submit"
          variant="secondary"
          disabled={!online || !formState.isDirty}
          loading={rename.isPending}
        >
          Save name
        </Button>
      </form>
    </Card>
  )
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hid, household } = useCurrentHousehold()
  const userId = useUserId()
  const del = useDeleteHousehold(hid, userId)
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title="Delete home">
      <div className="flex flex-col gap-4">
        <p>
          Type <strong>{household.name}</strong> to confirm.
        </p>
        <TextField
          label="Home name"
          value={typed}
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value)
          }}
        />
        {del.isError && <Banner tone="error">{errorMessage(del.error)}</Banner>}
        <Button
          variant="danger"
          size="lg"
          disabled={typed.trim() !== household.name}
          loading={del.isPending}
          onClick={() => {
            del.mutate(undefined, {
              onSuccess: () => {
                void navigate('/', { replace: true })
              },
            })
          }}
        >
          Delete permanently
        </Button>
      </div>
    </Sheet>
  )
}
