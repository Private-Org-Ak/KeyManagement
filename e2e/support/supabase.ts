/**
 * E2E helpers for the LOCAL Supabase stack only. Keys are read at test time from
 * `supabase status` and never written anywhere. The service-role key is used here (test
 * tooling) only as a fallback to fetch an OTP — it never appears under src/ (rule 2).
 */
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

interface LocalStack {
  apiUrl: string
  anonKey: string
  serviceKey: string
  mailpitUrl: string
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
    stack =
      env.API_URL && env.ANON_KEY && env.SERVICE_ROLE_KEY
        ? {
            apiUrl: env.API_URL,
            anonKey: env.ANON_KEY,
            serviceKey: env.SERVICE_ROLE_KEY,
            mailpitUrl: env.MAILPIT_URL ?? env.INBUCKET_URL ?? 'http://127.0.0.1:54324',
          }
        : null
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

function admin() {
  const s = requireStack()
  return createClient(s.apiUrl, s.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@e2e.test`
}

interface MailpitSearch {
  messages: { ID: string; Created: string }[]
}

/** Latest 6-digit code from Mailpit, if the email template includes {{ .Token }}. */
async function otpFromMailpit(email: string, since: number): Promise<string | null> {
  const { mailpitUrl } = requireStack()
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    )
    if (res.ok) {
      const data = (await res.json()) as MailpitSearch
      const latest = data.messages.find((m) => new Date(m.Created).getTime() >= since - 2000)
      if (latest) {
        const msg = (await (await fetch(`${mailpitUrl}/api/v1/message/${latest.ID}`)).json()) as {
          Text: string
        }
        return /\b(\d{6})\b/.exec(msg.Text)?.[1] ?? null
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

/**
 * The OTP for `email`: from the mail catcher when the template shows the code, otherwise
 * from the admin API (generates a fresh code for the same user).
 */
export async function getOtp(email: string, since: number): Promise<string> {
  const fromMail = await otpFromMailpit(email, since)
  if (fromMail) return fromMail
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  return data.properties.email_otp
}

/** Signs in through the real UI: email → code → app. */
export async function login(page: Page, email: string, startPath = '/'): Promise<void> {
  await page.goto(startPath)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByLabel('6-digit code')).toBeVisible()
  const code = await getOtp(email, since)
  await page.getByLabel('6-digit code').fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeHidden()
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
