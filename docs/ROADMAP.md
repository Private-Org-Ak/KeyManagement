# KeyFinder — Roadmap

Work top to bottom. Tick a box only when its acceptance criteria pass along with `typecheck`, `lint` and `test`.

## Phase 0 — Scaffold

- [x] Vite + React + TS (strict), Tailwind, ESLint + Prettier, Vitest + Testing Library, Playwright.
- [x] All npm scripts from CLAUDE.md, including `dev:https` (`@vitejs/plugin-basic-ssl`, `--host`).
- [x] Folder structure from CLAUDE.md; React Router + TanStack Query providers; error boundary.
- [x] `vite-plugin-pwa` with manifest, placeholder icons (192/512/maskable), iOS meta tags, SW deny-list for Supabase.
- [x] `src/lib/supabase.ts` reading `VITE_` env vars and failing loudly if they are missing.

**Accept:** `npm run build` succeeds; Chrome reports the app installable in `preview` (Lighthouse ≥ 12 dropped its PWA audit — see D11); one smoke unit test and one e2e test pass.

## Phase 1 — Database

- [x] `npx supabase init` (keep the existing migration); `npm run db:reset` applies cleanly.
- [x] `npm run db:types` generates `src/types/database.ts`.
- [x] pgTAP tests in `supabase/tests/` covering **all 10 cases** in SECURITY.md.
- [x] `supabase/seed.sql`: two test users, two households, a few doors and keys (dev only).

**Accept:** `npm run db:test` is green.

## Phase 2 — Auth

- [x] Login: email → 6-digit OTP code screen (resend with cooldown, error states). **Replaced by email/phone + password (D30, 2026-11-01).**
- [x] Session guard and `?next=` redirect; sign out (wipes Dexie).
- [x] ~~Local OTP testing through the Supabase Inbucket/Mailpit UI.~~ Obsolete with D30: no auth emails.

**Accept:** e2e test logs in through the local mail catcher and lands on `/onboarding`.

**Status (2026-11-01):** Login is email or phone + password (D30); `e2e/auth.spec.ts` covers sign-up (email and phone), sign-in with a locally typed 10-digit number, wrong password, duplicate account, validation, change password and sign-out wipe. **Earlier status (2026-10-31):** `e2e/auth.spec.ts` logs in through the real UI and lands on `/onboarding` ✅. The test reads the code from Mailpit when the email contains it and otherwise falls back to the admin `generateLink` OTP — on this machine the Supabase CLI fails to copy `supabase/templates/otp.html` into the auth container under Colima (`ContainerCreateError … must be a directory`), so the local email shows a link, not the code. Item 3 stays open until that works (Docker Desktop/OrbStack, or a CLI fix). Meanwhile `content_path` is commented out (with it, `supabase start` fails on Colima) and `npm run dev:code -- <email>` prints a valid code for local sign-in.

## Phase 3 — Households & members

- [x] Onboarding: create a home (`create_household`) or join with a code (`accept_invite`).
- [x] `/join/:code` survives the login redirect.
- [x] Household switcher; remember the last household.
- [x] Members screen: list with roles; invite (role picker per matrix; Web Share API, falling back to copy); pending invites with revoke; remove member; leave.
- [x] UI hides actions the role can't perform (cosmetic; DB enforces).
- [x] Error mapping from SECURITY.md.

**Accept:** e2e — user A creates a home and invites; user B joins; A removes B; B is bounced out on the next navigation.

**Status:** ✅ `e2e/households.spec.ts` (plus single-use invite, cosmetic role UI, local wipe on removal). Rename/delete household added in Settings.

## Phase 4 — Doors & keys

- [x] Doors list grouped by `room_group`/floor; create/edit/delete (delete for admin+ only).
- [x] "Add room with washroom" creates two doors sharing a `room_group`.
- [x] Key create/edit: number, door, label, holder; "Add second copy" duplicates the number with label "Copy 2".
- [x] Quick-add loop for fast setup (PRD "Setup UX").
- [x] Photo upload: resize, strip EXIF, upload to `{hid}/{keyId}.jpg`, signed URL display.

**Accept:** 20 doors and 40 keys can be entered on a phone in under 15 minutes; the photo of a non-member's key is inaccessible.

**Status:** photo isolation ✅ (`e2e/doors-keys.spec.ts` + pgTAP). The 15-minute phone timing is a manual check — see `docs/DEPLOY.md` §3.

## Phase 5 — Search

- [x] `normalize.ts`, `match.ts` with thorough unit tests (look-alikes, gaps, copies, master keys).
- [x] Home: autofocus search, live results grouped by door, recent lookups.
- [x] Reverse lookup on door detail (its keys and holders).

**Accept:** typing any 3+ characters of a stored number shows its door within 100 ms on 40 keys.

**Status:** ✅ unit test (`match.test.ts`, 40 keys < 100 ms) and e2e search flow.

## Phase 6 — Offline

- [x] Dexie schema + full-refresh sync per household (triggers per ARCHITECTURE.md).
- [x] Search reads from Dexie; offline banner; edits disabled offline.
- [x] Thumbnails cached as blobs; cleanup for left/removed households.
- [x] `navigator.storage.persist()`; iOS install guide screen; SW update toast.

**Accept:** in `preview`, airplane mode → reopen installed app → search works and shows thumbnails.

**Status:** ✅ `e2e/offline.spec.ts` (desktop + Pixel 7 profiles, Chromium). Real iPhone/Android check in `docs/DEPLOY.md` §3.

## Phase 7 — QR tags

- [x] Printable A4 sheet of N tags (`kf1:` + base32), lazy-loaded `qrcode`.
- [x] Scanner: `BarcodeDetector`, falling back to `@zxing/browser`; assign/clear tag on key detail; scan-to-lookup.

**Accept:** works on iPhone Safari (installed) and Android Chrome; a duplicate tag shows a friendly error.

**Status:** camera → QR decode → assign → lookup ✅ in Chromium with a fake camera (`e2e/qr.spec.ts`); duplicate-tag message mapped and unit-tested. Real iPhone/Android check pending (`docs/DEPLOY.md` §3).

## Phase 8 — NFC (Android)

- [x] Feature-detected NFC tab; assign and lookup via `serialNumber`.

**Accept:** hidden on iOS; works on Android Chrome.

**Status:** feature detection + reader unit-tested; hidden where `NDEFReader` is missing. Needs a real Android device + NFC sticker.

## Phase 9 — OCR

- [x] Camera screen with guide box; capture on tap; tracks stopped on exit.
- [x] Preprocessing (`image.ts`) + Tesseract worker (self-hosted assets, whitelist, PSM 7→11, 0°/180°, normal/inverted).
- [x] Results: "I read: …" + exact hit or top-3 fuzzy; edit and retry.
- [ ] Test fixtures: photos of real keys in `tests/fixtures/keys/` with expected numbers; a test reports the hit rate.

**Accept:** ≥ 70% exact or top-3 hits on fixtures; under 2 s per scan on a mid-range phone; works offline after first use.

**Status:** pipeline + harness ✅ — `e2e/ocr.spec.ts` gets 12/12 on synthetic engraved/inverted/tilted/upside-down images. **Item 4 stays open:** no real key photos yet in `tests/fixtures/keys/`; the hit-rate and mid-range-phone timing criteria need them.

## Phase 10 — Optional LLM fallback

- [x] Edge Function `read-key-number` per ARCHITECTURE.md (JWT + membership check, size limit, rate limit, secrets).
- [x] "Try harder" button after OCR failure.

**Accept:** no API key in the client bundle; requests from non-members are rejected; the rate limit works.

**Status:** built, **off by default** (`VITE_ENABLE_LLM_FALLBACK`). No key in the bundle ✅ (checked `dist/`); membership + per-user daily limit enforced in Postgres (`consume_ocr_quota`, pgTAP `07_ocr_quota.test.sql`) ✅. The function itself has not been executed (no local edge runtime/Deno here; needs your API key) — `docs/DEPLOY.md` §4.

## Phase 11 — Ship

- [x] Production Supabase project setup checklist (done by the owner): migrations, Site/redirect URLs, custom SMTP, OTP template with `{{ .Token }}`. (Superseded by D30: confirmations off, phone provider with placeholder SMS values, no SMTP.)
- [ ] Deploy the frontend with SPA rewrites; real icons and splash screens.
- [x] Accessibility pass (labels, contrast, focus, screen reader on scan results).

**Accept:** the family installs it on their phones and uses it for a week.

**Status:** checklist in `docs/DEPLOY.md`; host config (`vercel.json`, `public/_headers`, `public/_redirects`) with a CSP that every e2e run uses. Deploy + real icons are yours to do. Accessibility: axe WCAG 2.1 A/AA clean on all core screens in light and dark (`e2e/a11y.spec.ts`); a manual VoiceOver/TalkBack pass is still worthwhile.

## Later

Ownership transfer, change member role, activity log ("who moved key X"), Capacitor wrapper for the stores, auto-capture OCR, Hindi UI.
