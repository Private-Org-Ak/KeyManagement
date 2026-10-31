import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Banner, Button, Card, PageHeader, CardHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSignOut } from '@/features/auth/api'
import { isIos, isStandalone, useInstallPrompt } from '@/lib/install'
import { errorMessage } from '@/lib/errors'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export function AccountPage() {
  const { email } = useAuth()
  const signOut = useSignOut()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" back="/" />
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">Signed in as</p>
        <p className="font-medium break-all">{email}</p>
        {signOut.isError && <Banner tone="error">{errorMessage(signOut.error)}</Banner>}
        <Button
          variant="secondary"
          loading={signOut.isPending}
          onClick={() => {
            signOut.mutate(undefined, {
              onSettled: () => {
                void navigate('/login', { replace: true })
              },
            })
          }}
        >
          Sign out
        </Button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Signing out removes all homes, keys and photos stored on this device.
        </p>
      </Card>
      <InstallCard />
      <StorageCard />
    </div>
  )
}

export function InstallCard() {
  const { canPrompt, prompt } = useInstallPrompt()
  if (isStandalone()) {
    return (
      <Card>
        <CardHeader icon="check" title="App installed" tone="emerald" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          KeyFinder is running as an installed app.
        </p>
      </Card>
    )
  }
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader icon="phone" title="Install KeyFinder" />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Installing puts KeyFinder on your home screen and lets you look up keys without internet.
      </p>
      {isIos() ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap the <strong>Share</strong> button (square with an arrow).
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>Open KeyFinder from your home screen and sign in there.</li>
        </ol>
      ) : canPrompt ? (
        <Button onClick={() => void prompt()}>Install app</Button>
      ) : (
        <p className="text-sm">
          In Chrome, open the menu <strong>⋮</strong> and choose <strong>Install app</strong> or{' '}
          <strong>Add to Home screen</strong>.
        </p>
      )}
    </Card>
  )
}

function StorageCard() {
  const q = useQuery({
    queryKey: ['device', 'storage'],
    networkMode: 'always',
    queryFn: async () => {
      const storage = (navigator as { storage?: StorageManager }).storage
      const persisted = storage ? await storage.persisted() : false
      const est: StorageEstimate = storage ? await storage.estimate() : {}
      return { persisted, usage: est.usage ?? 0, quota: est.quota ?? 0 }
    },
  })
  return (
    <Card className="flex flex-col gap-1">
      <CardHeader icon="shield" title="Offline storage" tone="emerald" />
      {q.data && (
        <>
          <p className="text-sm">
            Using {formatBytes(q.data.usage)}
            {q.data.quota ? ` of ${formatBytes(q.data.quota)}` : ''}.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {q.data.persisted
              ? 'Protected: your browser won’t clear this data automatically.'
              : 'Not protected yet — install the app so the browser keeps your offline data.'}
          </p>
        </>
      )}
    </Card>
  )
}
