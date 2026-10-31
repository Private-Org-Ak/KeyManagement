import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { writeQrY4m } from './e2e/support/y4m'

// E2E runs against the production build (`preview`) so the service worker, manifest and
// offline behaviour are real. Supabase values come from .env.local (local stack).
const fileEnv = loadEnv('production', process.cwd(), 'VITE_')
const env = {
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY ??
    fileEnv.VITE_SUPABASE_ANON_KEY ??
    'e2e-placeholder-anon-key',
}

const qrVideo = writeQrY4m('test-results/.fake-camera/qr.y4m')

const chromeFakeCamera = {
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...chromeFakeCamera },
      testIgnore: /qr\.spec\.ts/,
    },
    // Fake camera that shows a KeyFinder QR tag.
    {
      name: 'qr-camera',
      testMatch: /qr\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-video-capture=${qrVideo}`,
          ],
        },
      },
    },
    // Phone viewport for the smoke + offline flows.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], ...chromeFakeCamera },
      testMatch: /(smoke|offline)\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env,
  },
})
