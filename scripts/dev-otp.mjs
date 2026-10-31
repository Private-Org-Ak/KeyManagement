// LOCAL DEVELOPMENT ONLY: prints a valid 6-digit sign-in code for an email.
// Use after tapping "Send code" in the app: npm run dev:code -- you@example.com
// Reads the local stack's keys from `supabase status` at runtime (never stored), and refuses
// to run against anything but localhost. Not part of the app bundle (CLAUDE.md rule 2).
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Usage: npm run dev:code -- you@example.com')
  process.exit(1)
}

let out
try {
  out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch {
  console.error('Local Supabase is not running. Start it with: npx supabase start -x studio')
  process.exit(1)
}
const env = Object.fromEntries(
  out
    .split('\n')
    .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
const url = env.API_URL
const key = env.SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Could not read the local Supabase URL/keys from `supabase status`.')
  process.exit(1)
}
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  console.error(`Refusing to run against a non-local Supabase (${url}).`)
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (error) {
  console.error(
    error.status === 404 || /not.*found/i.test(error.message)
      ? 'No account for that email yet — tap "Send code" in the app first.'
      : `Failed: ${error.message}`,
  )
  process.exit(1)
}
console.log(
  `\n  Code for ${email}: ${data.properties.email_otp}\n  (replaces the emailed one; valid for 10 minutes)\n`,
)
