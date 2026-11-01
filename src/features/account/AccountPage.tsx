import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Banner, Button, Icon, PageHeader, SectionTitle, TextField, cx } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useChangePassword, useSignOut } from '@/features/auth/api'
import { newPassword } from '@/features/auth/schemas'
import { errorMessage } from '@/lib/errors'

export function AccountPage() {
  const { account } = useAuth()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const isPhone = account?.startsWith('+') ?? false

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" back="/" />

      <section
        aria-label="Profile"
        className="bg-brand-gradient flex items-center gap-4 rounded-[1.5rem] p-5 text-white shadow-float"
      >
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-extrabold text-slate-950 shadow-card"
          aria-hidden="true"
        >
          {isPhone ? (
            <Icon name="user" className="size-7" />
          ) : (
            (account?.trim()[0] ?? 'K').toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/75 uppercase">
            <Icon name={isPhone ? 'phone' : 'mail'} className="size-3.5" />
            Signed in with {isPhone ? 'phone' : 'email'}
          </p>
          <p className="mt-0.5 text-lg leading-snug font-bold tracking-tight break-all">
            {account}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Security</SectionTitle>
        <ChangePasswordRow />
      </section>

      <section className="flex flex-col gap-2">
        {signOut.isError && <Banner tone="error">{errorMessage(signOut.error)}</Banner>}
        <Button
          variant="secondary"
          size="lg"
          className="w-full text-red-600! dark:text-red-400!"
          loading={signOut.isPending}
          onClick={() => {
            signOut.mutate(undefined, {
              onSettled: () => {
                void navigate('/login', { replace: true })
              },
            })
          }}
        >
          <Icon name="logout" />
          Sign out
        </Button>
        <p className="px-4 text-center text-xs text-slate-600 dark:text-slate-400">
          Signing out removes all homes, keys and photos stored on this device.
        </p>
      </section>
    </div>
  )
}

const changePasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: 'The passwords don’t match.',
    path: ['confirm'],
  })

/** Collapsed row; the form mounts only when expanded (fields reset on collapse). */
function ChangePasswordRow() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o)
        }}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          aria-hidden="true"
        >
          <Icon name="shield" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Change password</span>
          <span className="block text-sm text-slate-600 dark:text-slate-400">
            Set a new sign-in password
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={cx(
            'size-5 shrink-0 text-slate-400 transition-transform duration-300 ease-soft',
            open && 'rotate-180',
          )}
        />
      </button>
      <div id={panelId} hidden={!open}>
        {open && <ChangePasswordForm />}
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const change = useChangePassword()
  type In = z.input<typeof changePasswordSchema>
  type Out = z.output<typeof changePasswordSchema>
  const { register, handleSubmit, formState, reset } = useForm<In, unknown, Out>({
    resolver: zodResolver(changePasswordSchema),
  })
  return (
    <form
      noValidate
      className="animate-rise flex flex-col gap-3 border-t border-black/5 px-4 pt-4 pb-4 dark:border-white/8"
      onSubmit={(e) => {
        void handleSubmit(({ password }) => {
          change.mutate(password, {
            onSuccess: () => {
              reset()
            },
          })
        })(e)
      }}
    >
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        error={formState.errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        error={formState.errors.confirm?.message}
        {...register('confirm')}
      />
      {change.isError && <Banner tone="error">{errorMessage(change.error)}</Banner>}
      {change.isSuccess && <Banner tone="success">Password changed.</Banner>}
      <Button type="submit" loading={change.isPending}>
        Save new password
      </Button>
    </form>
  )
}
