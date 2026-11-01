import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Bottom sheet on phones, centered dialog on wider screens. Built on <dialog> for
 * focus trapping, Esc-to-close and an accessible modal role.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="animate-sheet-up sm:animate-pop m-0 mt-auto w-full max-w-none rounded-t-[1.5rem] bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[1.5rem] dark:bg-surface-dark dark:text-slate-100"
    >
      {/* Content is mounted only while open: forms reset and no hidden duplicate fields. */}
      <div className="pb-safe flex max-h-[85dvh] flex-col">
        <div
          className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-600"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between gap-2 px-5 pt-2 pb-1">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-full text-2xl leading-none text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-3 pb-6">{open && children}</div>
      </div>
    </dialog>
  )
}
