import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'

/**
 * User-facing errors are always generic (docs/SECURITY.md#error-mapping): raw messages may
 * contain household data or key numbers, so they are never rendered and only logged in dev.
 */
function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <main
      role="alert"
      className="pt-safe pb-safe px-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center"
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-400">{detail}</p>
      <button
        type="button"
        onClick={() => {
          window.location.assign('/')
        }}
        className="min-h-11 rounded-xl bg-slate-900 px-5 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Go to start
      </button>
    </main>
  )
}

const GENERIC = {
  title: 'Something went wrong',
  detail: 'Please try again. If it keeps happening, restart the app.',
}

interface State {
  hasError: boolean
}

/** Last-resort boundary around the whole app (providers included). */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) return <ErrorScreen {...GENERIC} />
    return this.props.children
  }
}

/** Route-level `errorElement`. */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorScreen title="Page not found" detail="That page doesn't exist." />
  }
  return <ErrorScreen {...GENERIC} />
}
