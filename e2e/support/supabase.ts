/**
 * E2E helpers for the LOCAL Supabase stack only. Keys are read at test time from
 * `supabase status` and never written anywhere.
 */
import { execFileSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'

interface LocalStack {
  apiUrl: string
  anonKey: string
}

let stack: LocalStack | null | undefined

export function localStack(): LocalStack | null {
  if (stack !== undefined) return stack
  try {
    const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const env = Object.fromEntries(
      out
        .split('\n')
        .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => [m[1], m[2]]),
    ) as Record<string, string | undefined>
    stack = env.API_URL && env.ANON_KEY ? { apiUrl: env.API_URL, anonKey: env.ANON_KEY } : null
  } catch {
    stack = null
  }
  return stack
}

export function requireStack(): LocalStack {
  const s = localStack()
  if (!s) throw new Error('Local Supabase is not running (npx supabase start)')
  return s
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@e2e.test`
}

export const PASSWORD = 'e2e-password-123'

/** A random Indian mobile number in E.164 (+91 9xxxxxxxxx). */
export function uniquePhone(): string {
  return `+919${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
}

/** Creates an account through the real UI (email or phone + password) and signs in. */
export async function login(page: Page, id: string, startPath = '/'): Promise<void> {
  await page.goto(startPath)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.getByRole('button', { name: 'New here' }).click()
  await page.getByLabel('Email or phone').fill(id)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Repeat password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeHidden()
}

/** Signs in to an existing account through the real UI. */
export async function signIn(page: Page, id: string, password = PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email or phone').fill(id)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Creates a home through onboarding; returns its id. */
export async function createHome(page: Page, name: string, displayName: string): Promise<string> {
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('Home name').fill(name)
  await page.getByLabel('Your name').fill(displayName)
  await page.getByRole('button', { name: 'Create home' }).click()
  await expect(page).toHaveURL(/\/h\/[0-9a-f-]{36}\/doors/)
  const hid = /\/h\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  if (!hid) throw new Error('no household id in URL')
  return hid
}

/** Bottom tab bar link. */
export function nav(page: Page, name: 'Find' | 'Scan' | 'Doors' | 'Members' | 'Settings') {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })
}
