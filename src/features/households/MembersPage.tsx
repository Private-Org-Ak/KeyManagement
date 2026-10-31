import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import type { z } from 'zod'
import {
  Banner,
  Button,
  Card,
  PageHeader,
  SelectField,
  Sheet,
  Spinner,
  TextField,
} from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { formatInviteCode, inviteLink } from '@/lib/inviteCode'
import { ROLE_LABEL, can, canRemove, invitableRoles } from '@/lib/roles'
import type { MemberRole } from '@/types/models'
import { useUserId } from '@/features/auth/AuthProvider'
import {
  useCreateInvite,
  useLeaveHousehold,
  useMembers,
  usePendingInvites,
  useRemoveMember,
  useRevokeInvite,
  type Member,
} from './api'
import { useCurrentHousehold } from './HouseholdContext'
import { inviteSchema } from './schemas'

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function MembersPage() {
  const { hid, household, online } = useCurrentHousehold()
  const userId = useUserId()
  const role = household.role
  const members = useMembers(hid)
  const invites = usePendingInvites(hid, can(role, 'view-invites'))
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [leaving, setLeaving] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        subtitle={household.name}
        actions={
          invitableRoles(role).length > 0 && (
            <Button
              disabled={!online}
              onClick={() => {
                setInviteOpen(true)
              }}
            >
              Invite
            </Button>
          )
        }
      />

      <section aria-labelledby="members-h" className="flex flex-col gap-2">
        <h2 id="members-h" className="sr-only">
          People
        </h2>
        {members.isPending && <Spinner label="Loading members…" />}
        {members.isError && <Banner tone="error">{errorMessage(members.error)}</Banner>}
        <ul className="surface divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
          {members.data?.map((m) => {
            const me = m.user_id === userId
            return (
              <li key={m.user_id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <div
                  className="bg-brand-gradient flex size-11 items-center justify-center rounded-2xl text-base font-bold text-white"
                  aria-hidden="true"
                >
                  {(m.display_name ?? 'M').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name ?? 'Member'}
                    {me && <span className="text-slate-600 dark:text-slate-400"> (you)</span>}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{ROLE_LABEL[m.role]}</p>
                </div>
                {!me && canRemove(role, m.role) && (
                  <Button
                    variant="ghost"
                    className="text-red-600 dark:text-red-400"
                    disabled={!online}
                    onClick={() => {
                      setRemoving(m)
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {can(role, 'view-invites') && (
        <section aria-labelledby="invites-h" className="flex flex-col gap-2">
          <h2 id="invites-h" className="px-1 text-lg font-bold">
            Pending invites
          </h2>
          {invites.data?.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">No pending invites.</p>
          )}
          <ul className="flex flex-col gap-2">
            {invites.data?.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                id={inv.id}
                role={inv.role}
                email={inv.email}
                expiresAt={inv.expires_at}
              />
            ))}
          </ul>
        </section>
      )}

      {can(role, 'leave') && (
        <Button
          variant="secondary"
          className="text-red-600 dark:text-red-400"
          disabled={!online}
          onClick={() => {
            setLeaving(true)
          }}
        >
          Leave this home
        </Button>
      )}

      <InviteSheet
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false)
        }}
        roles={invitableRoles(role)}
      />
      <RemoveSheet
        member={removing}
        onClose={() => {
          setRemoving(null)
        }}
      />
      <LeaveSheet
        open={leaving}
        onClose={() => {
          setLeaving(false)
        }}
      />
    </div>
  )
}

function PendingInviteRow({
  id,
  role,
  email,
  expiresAt,
}: {
  id: string
  role: MemberRole
  email: string | null
  expiresAt: string
}) {
  const { hid, online } = useCurrentHousehold()
  const revoke = useRevokeInvite(hid)
  return (
    <li>
      <Card className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{ROLE_LABEL[role]} invite</p>
          <p className="truncate text-sm text-slate-600 dark:text-slate-400">
            {email ? `For ${email} · ` : ''}expires {dateFmt.format(new Date(expiresAt))}
          </p>
          {revoke.isError && <p className="text-sm text-red-600">{errorMessage(revoke.error)}</p>}
        </div>
        <Button
          variant="ghost"
          disabled={!online}
          loading={revoke.isPending}
          onClick={() => {
            revoke.mutate(id)
          }}
        >
          Revoke
        </Button>
      </Card>
    </li>
  )
}

function InviteSheet({
  open,
  onClose,
  roles,
}: {
  open: boolean
  onClose: () => void
  roles: MemberRole[]
}) {
  const { hid, household } = useCurrentHousehold()
  const create = useCreateInvite(hid)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  type In = z.input<typeof inviteSchema>
  type Out = z.output<typeof inviteSchema>
  const { register, handleSubmit, formState, reset } = useForm<In, unknown, Out>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member', email: '' },
  })

  const close = () => {
    setCode(null)
    setCopied(false)
    create.reset()
    reset()
    onClose()
  }

  const link = code ? inviteLink(code) : ''
  const share = async () => {
    if (!code) return
    const text = `Join “${household.name}” on KeyFinder. Invite code: ${formatInviteCode(code)}`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'KeyFinder invite', text, url: link })
        return
      } catch {
        // cancelled or unsupported payload — fall back to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Invite someone">
      {code ? (
        <div className="flex flex-col gap-4">
          <p className="text-slate-600 dark:text-slate-400">
            Share this link or code. It works once and expires in 7 days.
          </p>
          <p
            data-testid="invite-code"
            className="rounded-2xl bg-brand-50 py-5 text-center font-mono text-2xl font-bold tracking-widest text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/30"
          >
            {formatInviteCode(code)}
          </p>
          <TextField
            label="Invite link"
            readOnly
            value={link}
            onFocus={(e) => {
              e.currentTarget.select()
            }}
          />
          <Button size="lg" onClick={() => void share()}>
            Share invite
          </Button>
          {copied && <Banner tone="success">Copied to clipboard.</Banner>}
          <Button variant="ghost" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            void handleSubmit((v) => {
              create.mutate(v, {
                onSuccess: (c) => {
                  setCode(c)
                },
              })
            })(e)
          }}
        >
          <SelectField label="Role" {...register('role')}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
                {r === 'admin'
                  ? ' — can invite and remove members'
                  : ' — can look up, add and edit keys'}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Email (optional)"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            hint="If set, only this email address can use the invite."
            error={formState.errors.email?.message}
            {...register('email')}
          />
          {create.isError && <Banner tone="error">{errorMessage(create.error)}</Banner>}
          <Button type="submit" size="lg" loading={create.isPending}>
            Create invite
          </Button>
        </form>
      )}
    </Sheet>
  )
}

function RemoveSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { hid } = useCurrentHousehold()
  const remove = useRemoveMember(hid)
  return (
    <Sheet
      open={!!member}
      onClose={() => {
        remove.reset()
        onClose()
      }}
      title="Remove member"
    >
      <div className="flex flex-col gap-4">
        <p>
          Remove <strong>{member?.display_name ?? 'this member'}</strong> from this home? They lose
          access immediately.
        </p>
        {remove.isError && <Banner tone="error">{errorMessage(remove.error)}</Banner>}
        <Button
          variant="danger"
          size="lg"
          loading={remove.isPending}
          onClick={() => {
            if (member)
              remove.mutate(member.user_id, {
                onSuccess: onClose,
              })
          }}
        >
          Remove
        </Button>
      </div>
    </Sheet>
  )
}

function LeaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hid, household } = useCurrentHousehold()
  const userId = useUserId()
  const leave = useLeaveHousehold(hid, userId)
  const navigate = useNavigate()
  return (
    <Sheet open={open} onClose={onClose} title="Leave home">
      <div className="flex flex-col gap-4">
        <p>
          Leave <strong>{household.name}</strong>? Its keys and doors will be removed from this
          phone. You’ll need a new invite to come back.
        </p>
        {leave.isError && <Banner tone="error">{errorMessage(leave.error)}</Banner>}
        <Button
          variant="danger"
          size="lg"
          loading={leave.isPending}
          onClick={() => {
            leave.mutate(undefined, {
              onSuccess: () => {
                void navigate('/', { replace: true })
              },
            })
          }}
        >
          Leave
        </Button>
      </div>
    </Sheet>
  )
}
