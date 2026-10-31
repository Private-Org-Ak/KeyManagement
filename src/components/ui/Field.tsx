import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from './cx'

const control =
  'block min-h-12 w-full rounded-2xl border-0 bg-slate-100/80 px-4 text-base text-slate-900 ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-60 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:bg-white/10 dark:focus:ring-brand-400'

interface FieldShellProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
  children: ReactNode
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="pl-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="pl-1 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="pl-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id: idProp, ...rest },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(control, error && 'ring-2 ring-red-500/70', className)}
        {...rest}
      />
    </FieldShell>
  )
})

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, id: idProp, ...rest },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(control, 'min-h-24 py-3', className)}
        {...rest}
      />
    </FieldShell>
  )
})

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  hint?: ReactNode
  error?: string | undefined
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, className, id: idProp, children, ...rest },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(
          control,
          'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
})
