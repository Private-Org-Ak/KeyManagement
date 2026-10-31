import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import type { z } from 'zod'
import { Banner, Button, Card, TextField, cx } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { formatInviteCode } from '@/lib/inviteCode'
import { useUserId } from '@/features/auth/AuthProvider'
import { useAcceptInvite, useCreateHousehold, useHouseholds } from './api'
import { createHouseholdSchema, joinSchema } from './schemas'

type Tab = 'create' | 'join'

export function OnboardingPage() {
  const households = useHouseholds()
  const [tab, setTab] = useState<Tab>('create')
  const first = households?.length === 0

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="bg-brand-gradient relative overflow-hidden rounded-[2rem] p-6 text-white shadow-float">
        <div
          className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-accent-400/25"
          aria-hidden="true"
        />
        <div className="relative">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="mb-4 size-14 rounded-2xl ring-4 ring-white/20"
          />
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            {first ? 'Welcome to KeyFinder' : 'Add a home'}
          </h1>
          <p className="mt-1.5 text-white/85">
            Create a home and add its doors and keys, or join a home someone shared with you.
          </p>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Get started"
        className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1 dark:bg-white/5"
      >
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
            }}
            className={cx(
              'min-h-11 rounded-xl text-sm font-bold transition',
              tab === t
                ? 'bg-white text-brand-700 shadow-card dark:bg-surface-dark-2 dark:text-brand-200'
                : 'text-slate-600 dark:text-slate-400',
            )}
          >
            {t === 'create' ? 'Create a home' : 'Join with a code'}
          </button>
        ))}
      </div>
      <Card>{tab === 'create' ? <CreateForm /> : <JoinForm />}</Card>
    </div>
  )
}

function CreateForm() {
  const userId = useUserId()
  const navigate = useNavigate()
  const create = useCreateHousehold(userId)
  type In = z.input<typeof createHouseholdSchema>
  type Out = z.output<typeof createHouseholdSchema>
  const { register, handleSubmit, formState } = useForm<In, unknown, Out>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: '', displayName: '' },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        void handleSubmit((v) => {
          create.mutate(v, {
            onSuccess: (hid) => {
              void navigate(`/h/${hid}/doors?setup=1`, { replace: true })
            },
          })
        })(e)
      }}
    >
      <TextField
        label="Home name"
        placeholder="e.g. Sharma House"
        autoFocus
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Your name"
        hint="Shown to other members of this home."
        autoComplete="given-name"
        error={formState.errors.displayName?.message}
        {...register('displayName')}
      />
      {create.isError && <Banner tone="error">{errorMessage(create.error)}</Banner>}
      <Button type="submit" size="lg" loading={create.isPending}>
        Create home
      </Button>
    </form>
  )
}

export function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const userId = useUserId()
  const navigate = useNavigate()
  const accept = useAcceptInvite(userId)
  type In = z.input<typeof joinSchema>
  type Out = z.output<typeof joinSchema>
  const { register, handleSubmit, formState } = useForm<In, unknown, Out>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: initialCode ? formatInviteCode(initialCode) : '', displayName: '' },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        void handleSubmit((v) => {
          accept.mutate(v, {
            onSuccess: (hid) => {
              void navigate(`/h/${hid}/doors`, { replace: true })
            },
          })
        })(e)
      }}
    >
      <TextField
        label="Invite code"
        placeholder="ABCD-1234-EF56-7890"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        autoFocus={!initialCode}
        className="font-mono tracking-wider uppercase"
        error={formState.errors.code?.message}
        {...register('code')}
      />
      <TextField
        label="Your name"
        hint="Shown to other members of this home."
        autoComplete="given-name"
        autoFocus={!!initialCode}
        error={formState.errors.displayName?.message}
        {...register('displayName')}
      />
      {accept.isError && (
        <Banner tone="error">{errorMessage(accept.error, 'accept_invite')}</Banner>
      )}
      <Button type="submit" size="lg" loading={accept.isPending}>
        Join home
      </Button>
    </form>
  )
}
