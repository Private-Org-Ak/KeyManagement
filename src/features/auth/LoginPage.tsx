import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Banner, Button, Icon, TextField } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { safeNext } from '@/lib/local'
import { useSendCode, useVerifyCode } from './api'
import { useAuth } from './AuthProvider'

const RESEND_SECONDS = 60

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')),
})
const codeSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().length(6, 'Enter the 6-digit code from the email.')),
})
type EmailInput = z.input<typeof emailSchema>
type EmailOutput = z.output<typeof emailSchema>
type CodeInput = z.input<typeof codeSchema>
type CodeOutput = z.output<typeof codeSchema>

function useCountdown(): [number, (s: number) => void] {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => {
      setLeft((v) => v - 1)
    }, 1000)
    return () => {
      clearTimeout(t)
    }
  }, [left])
  return [left, setLeft]
}

export function LoginPage() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState<string | null>(null)

  if (!loading && session) return <Navigate to={next} replace />

  return (
    <div className="-mx-4 -mt-2 flex min-h-dvh flex-col sm:mx-auto sm:max-w-md">
      <div className="bg-brand-gradient pt-safe relative overflow-hidden px-6 pb-16 text-white sm:mt-6 sm:rounded-[2rem]">
        <div
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-accent-400/20"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center pt-12 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="size-20 rounded-[1.5rem] shadow-2xl ring-4 ring-white/20"
          />
          <p className="mt-5 text-sm font-semibold tracking-widest text-white/80 uppercase">
            KeyFinder
          </p>
          <p className="mt-1 text-2xl leading-snug font-extrabold">
            Every key, every door.
            <br />
            Found in seconds.
          </p>
        </div>
      </div>
      <div className="relative -mt-10 px-4 pb-10">
        <div className="surface flex flex-col gap-5 p-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {email ? (
                <>
                  We sent a 6-digit code to{' '}
                  <strong className="break-all text-slate-700 dark:text-slate-200">{email}</strong>.
                </>
              ) : (
                'Enter your email and we’ll send you a 6-digit code. No password needed.'
              )}
            </p>
          </div>
          {email ? (
            <CodeStep
              email={email}
              onChangeEmail={() => {
                setEmail(null)
              }}
            />
          ) : (
            <EmailStep onSent={setEmail} />
          )}
        </div>
        <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
          <li className="flex flex-col items-center gap-1.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card dark:bg-surface-dark dark:text-brand-300">
              <Icon name="search" />
            </span>
            Type a number
          </li>
          <li className="flex flex-col items-center gap-1.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card dark:bg-surface-dark dark:text-brand-300">
              <Icon name="camera" />
            </span>
            Scan a key
          </li>
          <li className="flex flex-col items-center gap-1.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card dark:bg-surface-dark dark:text-brand-300">
              <Icon name="wifiOff" />
            </span>
            Works offline
          </li>
        </ul>
      </div>
    </div>
  )
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const send = useSendCode()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailInput, unknown, EmailOutput>({ resolver: zodResolver(emailSchema) })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        void handleSubmit(({ email }) => {
          send.mutate(email, {
            onSuccess: () => {
              onSent(email)
            },
          })
        })(e)
      }}
    >
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        error={errors.email?.message}
        {...register('email')}
      />
      {send.isError && <Banner tone="error">{errorMessage(send.error)}</Banner>}
      <Button type="submit" size="lg" loading={send.isPending}>
        Send code
      </Button>
    </form>
  )
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const verify = useVerifyCode()
  const resend = useSendCode()
  const [cooldown, setCooldown] = useCountdown()
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeInput, unknown, CodeOutput>({ resolver: zodResolver(codeSchema) })

  useEffect(() => {
    setCooldown(RESEND_SECONDS)
  }, [setCooldown])

  const verifyError = verify.isError ? errorMessage(verify.error, 'verify_otp') : null

  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          void handleSubmit(({ code }) => {
            verify.mutate({ email, token: code })
          })(e)
        }}
      >
        <TextField
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={7}
          autoFocus
          className="text-center font-mono text-3xl font-bold tracking-[0.5em]"
          error={errors.code?.message}
          {...register('code')}
        />
        {verifyError && <Banner tone="error">{verifyError}</Banner>}
        {resent && !resend.isError && <Banner tone="success">A new code is on its way.</Banner>}
        {resend.isError && <Banner tone="error">{errorMessage(resend.error)}</Banner>}
        <Button type="submit" size="lg" loading={verify.isPending}>
          Sign in
        </Button>
      </form>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onChangeEmail}>
          Use another email
        </Button>
        <Button
          variant="ghost"
          disabled={cooldown > 0}
          loading={resend.isPending}
          onClick={() => {
            setResent(false)
            resend.mutate(email, {
              onSuccess: () => {
                setResent(true)
                setCooldown(RESEND_SECONDS)
              },
            })
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </Button>
      </div>
    </div>
  )
}
