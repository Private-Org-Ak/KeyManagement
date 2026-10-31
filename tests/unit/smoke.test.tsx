import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

// No session: every protected route must bounce to /login?next=…
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  },
}))
// The service-worker hook is a Vite virtual module; stub it for jsdom.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

const { routes } = await import('@/app/router')
const { Providers } = await import('@/app/providers')
const { AuthProvider } = await import('@/features/auth/AuthProvider')

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Providers>,
  )
  return router
}

describe('app shell (signed out)', () => {
  it('redirects / to the login screen', async () => {
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('keeps the requested page in ?next= (join links survive login)', async () => {
    const router = renderAt('/join/ABCD1234ABCD1234')
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe(
      '/join/ABCD1234ABCD1234',
    )
  })

  it('protects household routes', async () => {
    const router = renderAt('/h/11111111-1111-4111-8111-111111111111/doors')
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows a not-found screen for unknown routes', async () => {
    renderAt('/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
