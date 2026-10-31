import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AppErrorBoundary } from './ErrorBoundary'
import { Providers } from './providers'
import { router } from './router'

export function App() {
  return (
    <AppErrorBoundary>
      <Providers>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </Providers>
    </AppErrorBoundary>
  )
}
