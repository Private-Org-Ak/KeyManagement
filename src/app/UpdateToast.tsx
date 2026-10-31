import { useRegisterSW } from 'virtual:pwa-register/react'

/** Shown when a new service worker is waiting (`registerType: 'prompt'`). */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="pb-safe px-safe fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
        <p className="flex-1 text-sm">An update is available.</p>
        <button
          type="button"
          className="min-h-11 rounded-xl px-3 text-sm opacity-80"
          onClick={() => {
            setNeedRefresh(false)
          }}
        >
          Later
        </button>
        <button
          type="button"
          className="bg-brand-400 min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-900"
          onClick={() => {
            void updateServiceWorker(true)
          }}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
