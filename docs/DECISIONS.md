# Decisions

Append-only. Format: **ID — Decision** · Why · Revisit if.

- **D1 — PWA, not native apps.** One codebase, no store review, installable on iOS and Android, camera works. · Revisit if: NFC on iPhone or store presence becomes important → wrap with Capacitor.
- **D2 — Supabase with authorization in Postgres RLS.** Household isolation is enforced by the database, not app code. · Revisit if: we need complex cross-household logic.
- **D3 — Email OTP code, not magic link or OAuth.** iOS PWA storage is separate from Safari, so redirects lose the session. · Revisit if: Supabase/iOS behaviour changes, or phone OTP is wanted (needs a paid SMS provider).
- **D4 — Membership checked live, no household claims in the JWT.** Removal takes effect immediately. · Revisit if: performance becomes an issue (it won't at this scale).
- **D5 — All lookup and matching happens client-side on a cached list.** Tiny dataset, instant and works offline. · Revisit if: households exceed ~5,000 keys.
- **D6 — On-device OCR (Tesseract.js); LLM only as an optional server-side fallback.** Free, private, offline. · Revisit if: OCR hit rate on real keys is poor.
- **D7 — QR stickers as the primary tag, NFC as an Android-only extra.** Web NFC isn't available on iOS. · Revisit if: Safari ships Web NFC.
- **D8 — Offline is read-only.** Avoids sync conflicts for little benefit. · Revisit if: users need to edit in no-signal rooms.
- **D9 — Invite codes stored as SHA-256 hashes, single-use, 7-day expiry.** A database leak doesn't expose usable codes.
- **D10 — TypeScript pinned to `~6.0`, not 7.x.** `typescript-eslint` (needed for type-aware lint rules such as `no-explicit-any`/`no-unsafe-*`) supports TypeScript `<6.1` only. · Revisit if: `typescript-eslint` adds TS 7 support.
- **D11 — Installability is checked with Chrome's `Page.getInstallabilityErrors` in Playwright, not Lighthouse.** Lighthouse 12 removed the PWA category, so the Phase 0 criterion is now an automated e2e test (`e2e/smoke.spec.ts`). · Revisit if: Lighthouse reintroduces an installability audit.
- **D12 — Supabase "deny-list" in the service worker is implemented as `NetworkOnly` runtime routes** for `*.supabase.co` and the `VITE_SUPABASE_URL` origin (`vite.config.ts`). Supabase is always cross-origin, so precache and `navigateFallback` never touch it; the explicit routes stop any future rule from caching it. · Revisit if: Supabase is ever proxied through the app origin.
- **D13 — Own pgTAP helpers (`supabase/tests/_helpers.psql`) instead of `basejump-supabase_test_helpers`.** No extra extension to install; each test file includes them inside its own transaction, so test users, fixtures and helpers are rolled back. · Revisit if: the helper file grows large.
- **D14 — Local Supabase runs without realtime, analytics, vector storage and edge runtime** (`supabase/config.toml`). Unused by the app and keeps the stack within a 2 GB Docker VM. · Revisit if: Phase 10 (re-enable `edge_runtime`) or live updates are needed.
- **D15 — `npm run db:test:nomount` fallback** (`scripts/db-test-nomount.sh`) runs the same `pg_prove` image with `docker cp` instead of a bind mount, for Docker setups that can't mount the project folder (e.g. Colima without macOS Documents access). `npm run db:test` remains the canonical command. · Revisit if: the project moves out of `~/Documents` or mounts are fixed.
- **D16 — Door-name search uses Fuse extended search (space = AND of fuzzy words).** "master wash" must find _Master Bedroom Washroom_; a single fuzzy pattern doesn't. Operator characters in input are stripped. · Revisit if: search feels too loose.
- **D17 — OCR tries a plain contrast-stretched grayscale variant first**, then the binarized normal/inverted variants, each also rotated 180° (ARCHITECTURE listed only binarized). Tesseract binarizes clean images well itself; adaptive thresholding helps on uneven metal. Stops at the first exact hit. · Revisit if: real-photo hit rate (Phase 9 fixtures) says otherwise.
- **D18 — `Sheet` mounts its content only while open.** Forms reset on reopen and closed sheets don't leave hidden duplicate fields for screen readers/tests.
- **D19 — Recent lookups are door ids in `localStorage` (`kf.recent.<hid>`)**, never key numbers; wiped with the household (sign-out, leave, removal).
- **D20 — Deleting a household first removes its Storage photos from the client**, then deletes the row (Postgres cascades don't reach Storage). If the client dies in between, orphaned photos are unreadable (policy checks membership) but occupy space. · Revisit if: we add a server-side cleanup job.
- **D21 — Phase 10 LLM fallback is built but off** (`VITE_ENABLE_LLM_FALLBACK`, plus `ANTHROPIC_API_KEY` secret). Default model `claude-opus-5-5` at `effort: low` with JSON-schema structured output and server-side `fallbacks: "default"`; override with `ANTHROPIC_MODEL`. Quota table `ocr_usage` is user-scoped (no `household_id`), locked down, reachable only via `consume_ocr_quota()`. · Revisit if: cost/latency matters — try a cheaper vision model via the secret.
- **D22 — E2E tests get the OTP from Mailpit, else from the local admin `generateLink`.** The service-role key is read at test time from `supabase status` in `e2e/support/` only (never under `src/`, never written to disk). Needed because the CLI can't copy the custom email template into the auth container on Colima.
- **D23 — CSP and security headers are served by the static host** (`vercel.json`, `public/_headers`); `vite preview` serves the same CSP (plus the local Supabase origin) so every e2e run proves the app works under it. `'wasm-unsafe-eval'` is required for Tesseract's WASM.
- **D24 — OTP codes expire after 10 minutes** (`otp_expiry = 600`, mirrored in DEPLOY.md), down from Supabase's 1 h default.
- **D25 — Thumbnails are re-fetched when `keys.updated_at` changes** (photo path is stable `{hid}/{keyId}.jpg`, so the path alone can't signal a replaced photo).
- **D26 — Landing page after sign-in is Doors (`/h/:hid/doors`), not Find.** Requested by the owner: setup and browsing happen there; Find stays one tap away in the tab bar.
- **D27 — Design system:** (palette superseded by D32) indigo/violet brand gradient + brass/amber accent (keys), tinted canvas (`#f4f5fb` / dark `#0a0e1f`), elevated `surface` cards, colour-coded door-type tiles, floating tab bar with a raised Scan button. Tokens live in `src/index.css` (`@theme`). Muted text is `slate-600` (light) / `slate-400` (dark) to stay ≥ 4.5:1 on the tinted canvas — the axe e2e test enforces it.

## D28 — Phone testing via a same-origin Supabase proxy (2026-10-31)

`VITE_SUPABASE_URL=same-origin` makes the client use the page's origin; in Vite `phone` mode the preview server proxies `/auth|rest|storage|functions/v1` to the local stack. Why: a phone can't reach `127.0.0.1:54321`, and an HTTPS page can't call a plain-HTTP LAN API (mixed content). One origin also works unchanged behind a Cloudflare quick tunnel, which gives a valid certificate so install/offline can be tested. The service worker treats those same-origin paths as network-only and excludes them from the navigation fallback (rule 8). Production builds never use `same-origin`.

## D29 — Stamped-key OCR: locate text first, best-of-N frames, zoom/torch (2026-10-31)

Phone testing showed real keys misread (junk like "TEA"/"WEE") although clean synthetic images scored 100%. Cause: the whole guide crop (textured metal, glare) was binarized and fed to Tesseract with the digits only a small part of it. Now `focusOnText` (src/lib/image.ts) flattens lighting, finds the strongest text line from edge energy, crops tight, upscales to ~110 px line height, and that crop (+ Otsu/inverted) is tried before the old whole-frame variants. Capture takes 4 frames ~110 ms apart and keeps the sharpest (variance of Laplacian) to beat tap shake; the guide box is narrower; zoom chips (default 2×) and a light toggle appear where the camera exposes them (mostly Android Chrome). The e2e OCR benchmark gained "hard" stamped samples (no ink, small digits, glare, blur, JPEG): 33% → 83%, now asserted ≥ 70%. Real-photo tuning still needs `tests/fixtures/keys/`.

## D30 — Email or phone + password replaces email OTP (2026-11-01)

Supersedes D3, D22, D24. In production the OTP emails depended on custom SMTP (Supabase's sender is rate-limited and templates are locked without it), and the owner's SMTP (Brevo) timed out (`504 context deadline exceeded`). The owner chose email/phone + password and removing email-based auth.

- `signUp` / `signInWithPassword` with email or phone; phones normalised to E.164 in `src/lib/identifier.ts` (10-digit → +91). Min 8 / max 72 characters. Account screen can change the password.
- "Confirm email" and "Confirm phone" are off, so nothing is ever sent. Supabase refuses to enable phone login without an SMS provider, so placeholder Twilio values are configured (local `config.toml`, DEPLOY.md); they are never used.
- Emails/phones are therefore unverified login names. Security change: invites are no longer bound to an email in the UI (the binding would be bypassable by signing up with that address); the code itself (single-use, 7 days, hashed) remains the protection. The DB column/RPC parameter stay for now (no migration).
- No self-service reset (would need email/SMS); admin SQL reset in DEPLOY.md.
- Removed: OTP screen, `npm run dev:code`, `supabase/templates/otp.html`, Mailpit/admin OTP helpers in e2e (the e2e helpers no longer read the service-role key).
- Revisit if: SMS or reliable email becomes available → add "forgot password" via code.

## D31 — Invite QR, scanned in the app (2026-11-01)

On iPhone a tapped invite link opens Safari, whose storage is separate from the installed PWA, so the invitee ends up joining in the wrong place. Now:

- The invite sheet shows a QR of the join link (`qrcode`, already a lazy-loaded dependency for tag printing). An invitee in the same room scans it with **Join with a code → Scan invite QR** in their KeyFinder app; the code is filled in and they only add their name. Scanned with the phone's own camera it is just the link, so it still works the old way.
- The Scan → QR tab recognises an invite QR too and opens `/join/:code` (for someone already in another home).
- `parseInvitePayload` (src/lib/inviteCode.ts) accepts `…/join/<code>` from any host, or a bare code. Scanning only fills the field; joining still needs the user's tap and the `accept_invite` checks, so the host isn't trusted for anything.
- The share text now leads with the in-app route ("Open the KeyFinder app → Join with a code → enter …"), with the link second for people new to the app.
- No change to the security model: same single-use, 7-day, hashed codes.

## D32 — Visual refresh: CoolDock-style look (2026-11-01)

Supersedes the palette part of D27. Modelled on cooldock.app's tokens:

- Warm paper canvas `#edeceb` (dark: warm near-black `#0c0c0d`, surfaces `#18181a` / `#222225`), white `surface` cards with a hairline `black/5` ring and a soft wide shadow.
- Primary actions are ink black (white in dark mode), not a gradient. `brand` is now electric blue (`#006fff` at 500, `#0062e6` at 600 for ≥ 4.5:1 text on white), used for links, focus and badges. Brass `accent` stays for keys.
- `slate-*` is remapped in `@theme` to warm neutrals (muted text `slate-600` = `#65666a`, 4.8:1 on the canvas), so existing classes follow the palette without touching every component.
- Type: Inter variable with the optical-size axis (Inter Display at large sizes), self-hosted via `@fontsource-variable/inter` because the CSP allows only `font-src 'self'`. Headings use weight 760 and `-0.035em` tracking. Latin subsets are precached so the offline shell keeps the font.
- Radii: controls 13px (`rounded-2xl`), cards 20px (`rounded-3xl`), hero tiles 24px.
- `bg-brand-gradient` keeps its name but is now an ink tile with a blue corner glow (heroes, avatars, Scan button). The top header and the bottom tab bar use a frosted `glass` utility. Decorative blobs were removed from the heroes.
- New runtime dependency: `@fontsource-variable/inter` (font files only, no JS).
- Motion, CSS only (tokens in `@theme`): one ease `cubic-bezier(.2,.7,.2,1)`; each route's blocks rise in from a blur with a stagger (`page-enter` on a wrapper keyed by pathname); header drops in and the tab bar slides up on first load; sheets slide up (pop on wide screens) with a fading backdrop; search results rise in; buttons and tappable cards press/lift. Animations use `backwards` fill so no transform/filter lingers afterwards. `prefers-reduced-motion` turns it all off (durations and delays zeroed). The axe e2e audit waits for animations to settle before checking contrast.

## D33 — Slimmer login and Account screens (2026-11-01)

- Login: removed the "Type a number / Scan a key / Works offline" feature row under the form.
- Account: redesigned as a profile tile (email/phone the user signed in with), a **Security** section with a collapsed *Change password* row (form mounts on expand; submit is "Save new password"), and **Sign out** last. Removed the *Install KeyFinder* and *Offline storage* cards at the owner's request.
- Change password stays because it is the only way to change a password (no self-service reset; the admin reset in DEPLOY.md hands out a temporary password).
- Consequence: there is no in-app install help now (iOS has no install prompt). `src/lib/install.ts` is kept, unused, in case install help returns elsewhere (e.g. a one-time banner).
