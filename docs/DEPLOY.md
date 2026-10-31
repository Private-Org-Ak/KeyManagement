# KeyFinder — Production setup & deploy checklist

Done by the owner (needs your accounts). Nothing here is run automatically — CLAUDE.md rule 11.

## 0. Try it on phones before deploying (local stack)

`npm run phone` builds the app and serves it on your Wi-Fi over HTTPS. Supabase calls go to the
same address and the preview server forwards them to the local stack (`/auth|rest|storage|functions/v1`), so the phone needs only one URL.

|                                           | LAN only: `npm run phone`                          | Public tunnel: `npm run phone` + `npm run phone:tunnel`       |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| URL                                       | `https://<mac-lan-ip>:4173` (printed as "Network") | `https://<random>.trycloudflare.com` (printed by cloudflared) |
| Certificate                               | self-signed → tap through the warning              | valid                                                         |
| Sign-in, doors, keys, search, camera scan | ✅                                                 | ✅                                                            |
| Install to home screen, offline mode      | ❌ (service worker refuses self-signed certs)      | ✅                                                            |
| Same Wi-Fi needed                         | yes                                                | no                                                            |

- Sign-in codes: local email has no code (Colima), so run `npm run dev:code -- <email>` on the Mac and type the code on the phone.
- The tunnel needs `brew install cloudflared` (free, no account). It makes your local app reachable at a random public URL while it runs; Ctrl-C closes it. Data is your local database, not production.
- The URL changes each tunnel run, and an installed PWA is tied to its URL: reinstall after restarting the tunnel.

## 1. Supabase project (cloud)

- [ ] Create a project (region close to the family). Note the **Project URL** and **anon/publishable key** (Settings → API). Never copy the `service_role` key anywhere near the frontend.
- [ ] Link and push migrations from your machine:
  ```bash
  npx supabase login
  npx supabase link --project-ref <ref>
  npx supabase db push          # applies supabase/migrations/* (never seed.sql)
  ```
- [ ] Verify RLS is on for every table (Database → Tables shows "RLS enabled") and the private bucket `key-photos` exists (created by the init migration).
- [ ] **Auth → URL configuration**: Site URL = `https://<your-app-domain>`; add the same to Redirect URLs.
- [ ] **Auth → Providers → Email**: enabled; "Confirm email" may stay on (the OTP code confirms the address); **Email OTP length = 6**, **OTP expiry = 600 s** (matches local config).
- [ ] **Auth → Email templates**: paste `supabase/templates/otp.html` into **both** "Magic Link" and "Confirm signup". It must contain `{{ .Token }}` — the app asks for the 6-digit code (iOS installed PWAs can't use links).
- [ ] **Auth → SMTP**: configure a custom SMTP provider (the built-in sender is heavily rate-limited). Most providers have a free tier sufficient for a family.
- [ ] **Auth → Rate limits**: keep defaults (emails/hour is governed by your SMTP).

## 2. Frontend hosting (static)

Any static host works; config for each is in the repo:

| Host                       | Config used                                             |
| -------------------------- | ------------------------------------------------------- |
| Vercel                     | `vercel.json` (SPA rewrite + security headers)          |
| Netlify / Cloudflare Pages | `public/_redirects` (SPA) + `public/_headers` (headers) |

- [ ] Build settings: command `npm run build`, output `dist`, Node ≥ 22.
- [ ] Environment variables (build-time, public by nature):
  - `VITE_SUPABASE_URL=https://<ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon/publishable key>`
  - `VITE_APP_URL=https://<your-app-domain>`
  - (optional) `VITE_ENABLE_LLM_FALLBACK=true` — only after step 4.
- [ ] HTTPS is on by default on these hosts (required for camera and service worker).
- [ ] If you use a **custom Supabase domain**, add it to `connect-src` and `img-src` in the CSP (`public/_headers`, `vercel.json`) and to the SW network-only list (it's picked up automatically from `VITE_SUPABASE_URL` at build time).

## 3. Smoke test on real phones

- [ ] iPhone (Safari): open the site → Share → **Add to Home Screen** → open from the home screen → sign in with the emailed code (inside the installed app).
- [ ] Android (Chrome): menu → **Install app** → sign in.
- [ ] Create the home, add doors/keys, print QR tags (Settings → Print QR tags), assign a few.
- [ ] Airplane mode → open the installed app → search a key → door shows (with thumbnail).
- [ ] Scan → Number on a real key (first scan needs a connection to download OCR data, ~7 MB; offline afterwards).
- [ ] Android only: Scan → NFC with an NFC sticker.
- [ ] Time the full setup (target: 20 doors + 40 keys in under 15 minutes — ROADMAP Phase 4).
- [ ] Drop 10–20 real key photos into `tests/fixtures/keys/` (see README there) and run `npm run test:e2e -- e2e/ocr.spec.ts` against the local stack — Phase 9 needs ≥ 70% hits.

## 4. Optional — "Try harder" LLM fallback (Phase 10, paid)

Costs money per call (Anthropic API). Off unless you do all of this:

- [ ] Get an Anthropic API key (console.anthropic.com) and set a monthly spend limit there.
- [ ] Set secrets (never in `.env` files or the frontend):
  ```bash
  npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
  npx supabase secrets set ANTHROPIC_MODEL=claude-opus-5-5   # optional; default. A cheaper vision model also works.
  npx supabase secrets set OCR_DAILY_LIMIT=20                # optional; per user per day
  npx supabase functions deploy read-key-number
  ```
- [ ] Rebuild the frontend with `VITE_ENABLE_LLM_FALLBACK=true`.
- [ ] Check: a failed OCR scan shows **Try harder**; the 21st call in a day returns "Too many attempts".

## 5. Real icons

Placeholder icons are generated by `npm run icons`. Replace `public/icons/*.png` (192, 512, 512-maskable with content inside the central 80%, 180 apple-touch) and `public/favicon.svg` with real artwork before sharing widely.
