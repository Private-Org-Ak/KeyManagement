import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import type { z } from 'zod'
import { Banner, Button, TextField, cx } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { safeNext } from '@/lib/local'
import { useSignIn, useSignUp } from './api'
import { useAuth } from './AuthProvider'
import { signInSchema, signUpSchema } from './schemas'

type Mode = 'sign-in' | 'sign-up'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState<Mode>('sign-in')

  if (!loading && session) return <Navigate to={next} replace />

  return (
    <div className="-mx-4 -mt-2 flex min-h-dvh flex-col sm:mx-auto sm:max-w-md">
      <div className="bg-brand-gradient pt-safe relative overflow-hidden px-6 pb-16 text-white sm:mt-6 sm:rounded-[1.5rem]">
        <div className="relative flex flex-col items-center pt-12 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="size-20 rounded-[1.5rem] shadow-2xl ring-4 ring-white/20"
          />
          <p className="mt-5 text-sm font-semibold tracking-widest text-white/80 uppercase">
            KeyFinder
          </p>
          <p className="mt-1 text-[32px] leading-[1.02] font-extrabold tracking-tight">
            Every key, every door.
            <br />
            Found in seconds.
          </p>
        </div>
      </div>
      <div className="relative -mt-10 px-4 pb-10">
        <div className="surface flex flex-col gap-5 p-6">
          <div
            role="group"
            aria-label="Account"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-white/5"
          >
            {(
              [
                ['sign-in', 'I have an account'],
                ['sign-up', 'New here'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                }}
                className={cx(
                  'min-h-11 rounded-xl text-sm font-semibold transition',
                  mode === m
                    ? 'bg-white text-brand-700 shadow-card dark:bg-surface-dark-2 dark:text-brand-200'
                    : 'text-slate-600 dark:text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {mode === 'sign-in'
                ? 'Use the email or phone number and password you signed up with.'
                : 'Use your email or phone number and choose a password.'}
            </p>
          </div>
          {mode === 'sign-in' ? <SignInForm /> : <SignUpForm />}
        </div>
      </div>
    </div>
  )
}

const ID_HINT =
  'Phone: include the country code, e.g. +91 98765 43210 (10-digit numbers are taken as +91).'

function SignInForm() {
  const signIn = useSignIn()
  const [show, setShow] = useState(false)
  type In = z.input<typeof signInSchema>
  type Out = z.output<typeof signInSchema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(signInSchema) })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        void handleSubmit((v) => {
          signIn.mutate(v)
        })(e)
      }}
    >
      <IdField error={errors.id?.message} {...register('id')} />
      <TextField
        label="Password"
        type={show ? 'text' : 'password'}
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <ShowPassword show={show} onChange={setShow} />
      {signIn.isError && <Banner tone="error">{errorMessage(signIn.error, 'sign_in')}</Banner>}
      <Button type="submit" size="lg" loading={signIn.isPending}>
        Sign in
      </Button>
      <p className="text-center text-xs text-slate-600 dark:text-slate-400">
        Forgot your password? Ask whoever set up KeyFinder to reset it.
      </p>
    </form>
  )
}

function SignUpForm() {
  const signUp = useSignUp()
  const [show, setShow] = useState(false)
  type In = z.input<typeof signUpSchema>
  type Out = z.output<typeof signUpSchema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(signUpSchema) })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        void handleSubmit(({ id, password }) => {
          signUp.mutate({ id, password })
        })(e)
      }}
    >
      <IdField error={errors.id?.message} {...register('id')} />
      <TextField
        label="Password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Repeat password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm')}
      />
      <ShowPassword show={show} onChange={setShow} />
      {signUp.isError && <Banner tone="error">{errorMessage(signUp.error)}</Banner>}
      <Button type="submit" size="lg" loading={signUp.isPending}>
        Create account
      </Button>
    </form>
  )
}

function IdField(
  props: Omit<React.ComponentProps<typeof TextField>, 'label'> & { error?: string },
) {
  return (
    <TextField
      label="Email or phone"
      type="text"
      inputMode="email"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      hint={ID_HINT}
      {...props}
    />
  )
}

function ShowPassword({ show, onChange }: { show: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="-mt-1 flex min-h-11 items-center gap-3 text-sm font-medium">
      <input
        type="checkbox"
        className="size-5 accent-brand-600"
        checked={show}
        onChange={(e) => {
          onChange(e.target.checked)
        }}
      />
      Show password
    </label>
  )
}
