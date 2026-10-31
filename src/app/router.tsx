import { createBrowserRouter, type RouteObject } from 'react-router'
import { AccountPage } from '@/features/account/AccountPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DoorDetailPage } from '@/features/doors/DoorDetailPage'
import { DoorsPage } from '@/features/doors/DoorsPage'
import { HomeRedirect } from '@/features/households/HomeRedirect'
import { HouseholdLayout } from '@/features/households/HouseholdLayout'
import { JoinPage } from '@/features/households/JoinPage'
import { MembersPage } from '@/features/households/MembersPage'
import { OnboardingPage } from '@/features/households/OnboardingPage'
import { SettingsPage } from '@/features/households/SettingsPage'
import { KeyDetailPage } from '@/features/keys/KeyDetailPage'
import { QuickAddKeysPage } from '@/features/keys/QuickAddKeysPage'
import { PrintTagsPage } from '@/features/scan/qr/PrintTagsPage'
import { ScanPage } from '@/features/scan/ScanPage'
import { HomePage } from '@/features/search/HomePage'
import { AppShell } from './AppShell'
import { RouteError } from './ErrorBoundary'
import { NotFound } from './pages/NotFound'

// Route map from docs/ARCHITECTURE.md#routing.
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'onboarding', element: <OnboardingPage /> },
          { path: 'join/:code', element: <JoinPage /> },
          { path: 'account', element: <AccountPage /> },
          {
            path: 'h/:hid',
            element: <HouseholdLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'scan', element: <ScanPage /> },
              { path: 'doors', element: <DoorsPage /> },
              { path: 'doors/quick-keys', element: <QuickAddKeysPage /> },
              { path: 'doors/:did', element: <DoorDetailPage /> },
              { path: 'keys/:kid', element: <KeyDetailPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/tags', element: <PrintTagsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
