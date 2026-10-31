import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-600 dark:text-slate-400">That page doesn't exist.</p>
      <Link to="/" className="inline-flex min-h-11 items-center font-medium underline">
        Go to start
      </Link>
    </section>
  )
}
