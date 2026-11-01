# KeyFinder — Architecture

## Overview

```
 Phone (installed PWA)                                  Supabase
 ┌──────────────────────────────────────────┐         ┌────────────────────────────┐
 │ React UI ── TanStack Query ── api hooks ─┼─HTTPS──▶│ Auth (password → JWT)      │
 │     │                          │         │  JWT    │ PostgREST ─▶ Postgres + RLS│
 │     ▼                          ▼         │         │ RPCs (security definer)    │
 │ Search/match (local)      Dexie cache    │         │ Storage: key-photos (priv) │
 │     ▲                     (IndexedDB)    │         │ Edge fn: read-key-number   │
 │ Scan: Tesseract │ QR │ NFC (on-device)   │         │   (optional LLM fallback)  │
 │ Service worker: app shell only           │         └────────────────────────────┘
 └──────────────────────────────────────────┘
```

All lookups run **locally** against the cached household list. The server is used for auth, sync and edits.

## Routing

```
/login                      email or phone + password (sign in / create account)
/onboarding                 create a home | join with code
/join/:code                 join (redirects to /login first if needed, then back)
/h/:hid                     home: search + scan button
/h/:hid/scan                camera: Number (OCR) | QR | NFC
/h/:hid/doors               doors grouped by room_group / floor
/h/:hid/doors/quick-keys    quick-add keys loop (setup)
/h/:hid/doors/:did          door detail + its keys
/h/:hid/keys/:kid           key detail / edit
/h/:hid/members             members + invites
/h/:hid/settings            rename, print QR tags, delete
/h/:hid/settings/tags       printable A4 sheet of QR tags
/account                    profile, change password, sign out
```

`/` redirects to the **Doors** page of the last-used household (`/h/:hid/doors`, `localStorage: kf.lastHousehold`), else `/onboarding` (D26). Route guards: unauthenticated → `/login?next=…`; `hid` not in the user's memberships → `/`.

## Data layer

- `src/lib/supabase.ts` — a single client created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `persistSession: true`.
- `src/features/*/api.ts` — TanStack Query hooks. Query keys are always scoped: `['household', hid, 'keys']`.
- Mutations go to Supabase, then invalidate and re-sync that household's cache.
- RPCs are called with `supabase.rpc('create_household', {...})` etc. Map errors as described in SECURITY.md.

## Offline cache (Dexie)

- DB `keyfinder`, tables: `households`, `doors`, `keys`, `thumbs` (key photo thumbnail blobs), `meta` (`lastSyncedAt` per household).
- Every row stores `household_id`; all reads filter by it.
- **Sync = full refresh per household.** The dataset is tiny (~20 doors, ~40 keys), so: fetch all doors + keys for `hid` → replace that household's rows in one Dexie transaction. Trigger it on app open, window focus, coming back online, and after every mutation.
- Reads: the search screen reads from Dexie (`useLiveQuery`) so it works identically online and offline.
- Writes need a connection; disable edit buttons and show a banner while offline.
- Thumbnails: on sync, download missing photos via signed URL, resize to ≤ 200 px, store as a blob in `thumbs`. Never rely on signed URLs offline.
- Wipe: on sign-out clear everything; after sync, delete Dexie data for households the user is no longer a member of.
- After first successful login on an installed PWA, call `navigator.storage.persist()`.

## Key-number matching

Implemented in `src/lib/normalize.ts` and `src/lib/match.ts`, fully unit-tested.

1. **normalize(s)**: uppercase, remove every non `[A-Z0-9]` char. _Must equal_ the DB column `key_number_normalized`.
2. **canonical(s)**: `normalize(s)` and then map look-alikes: `O,Q→0`, `I,L→1`, `Z→2`, `S→5`, `G→6`, `B→8`. Applied to **both** stored numbers and input; comparison only, never stored or displayed.
3. **Typed search** (Home): key numbers by canonical exact < prefix < substring; door name/room group by Fuse.js extended search (each typed word must fuzzy-match, D16); results grouped by door.
4. **Scanned search** (OCR output):
   - Split OCR text into tokens; also try each adjacent pair joined (engraving gaps). Keep candidates of length 3–20.
   - Exact `canonical` match → hit.
   - Otherwise Levenshtein on canonical forms: distance ≤ 1 (≤ 2 if length ≥ 6) → candidates ranked by distance, then OCR confidence.
   - Show the single exact hit directly. Fuzzy hits: show the top 3 and require a tap. Always show "what I read" with an Edit option.
5. One number can map to several keys (copies) and, rarely, several doors (master keys). Group results by door and show all doors.

## Scanning pipeline (`src/features/scan/`)

Camera: `getUserMedia({ video: { facingMode: 'environment' } })`, overlay a guide rectangle, capture on tap (MVP; auto-capture later). Stop all tracks when leaving the screen.

### Number (OCR)

1. Crop the frame to the guide box; upscale to ~1000 px width.
2. Preprocess on a canvas (`src/lib/image.ts`): grayscale → contrast stretch (variant 1), then adaptive threshold → normal and inverted (variants 2–3; engravings can read light-on-dark or dark-on-light). Each is also tried rotated 180° (D17).
3. One Tesseract.js worker, created on first visit to Scan and then reused. `eng` language data, worker and core are self-hosted under `/public/tesseract/` (offline, no CDN). Whitelist `A-Z0-9-`. Try PSM 7 (single line); if that finds nothing, PSM 11 (sparse). Also try the image rotated 180° (key held upside down).
4. Merge candidates → matching (above). Target under 2 s on a mid-range phone; stop early on the first exact hit.
5. Runtime-cache the Tesseract assets on first use (CacheFirst, cache `kf-tesseract`; excluded from precache) so OCR works offline afterwards. `scripts/copy-tesseract.mjs` copies worker, LSTM cores and `eng` (4.0.0_best_int) into `public/tesseract/` before dev/build.

### QR tags

- A tag is an opaque random ID: payload `kf1:<16-char base32>` from `crypto.getRandomValues`. It contains no household information.
- Settings → "Print QR tags" renders an A4 sheet of N codes with a short human-readable suffix under each; the user prints, cuts and sticks them on key rings.
- Assign: on Key detail, "Assign tag" → scan → stored as `keys.tag_id`. Unique per household (DB index).
- Lookup: scan → find the key by `tag_id` in Dexie → show its door.
- Decoder: `BarcodeDetector` if available, else lazy-loaded `@zxing/browser`.

### NFC (Android Chrome only)

- `new NDEFReader().scan()` started from a button tap; use the `serialNumber` as `tag_id = 'nfc:' + serial`.
- Hidden when `!('NDEFReader' in window)`.

### LLM fallback (Phase 10, optional)

- Shown as "Try harder" only after OCR fails. Supabase Edge Function `read-key-number`:
  - requires a valid user JWT; checks membership of the `household_id` it was given using a user-scoped client;
  - accepts one JPEG (≤ 1 MB, cropped to the key);
  - calls the Anthropic Messages API with the image, asking for JSON `{"candidates": ["..."]}` only;
  - the API key and model come from Supabase secrets (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) and never touch the client;
  - per-user rate limit (e.g. 20/day, enforced through a table).
- Candidates go through the **same local matching**. The household's key list is never sent to the LLM.

## PWA

- `vite-plugin-pwa` with `registerType: 'prompt'` → show an "Update available" toast.
- Manifest: name, short_name, `display: standalone`, `start_url: '/'`, `scope: '/'`, theme and background colours, icons at 192, 512 and 512-maskable.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style; an in-app install guide when not in standalone mode.
- Workbox: precache the app shell; `navigateFallback: '/index.html'`; register **`NetworkOnly`** routes for `*.supabase.co` and the `VITE_SUPABASE_URL` origin so the service worker never caches API or Storage responses (D12).

## Security headers

Served by the static host (`vercel.json`, `public/_headers`): CSP (`script-src 'self' 'wasm-unsafe-eval'`, `connect-src`/`img-src` limited to self + Supabase, `frame-ancestors 'none'`), `nosniff`, `no-referrer`, `Permissions-Policy` (camera self only), HSTS. `vite preview` serves the same CSP so e2e tests run under it (D23).

## Feature flags

`VITE_ENABLE_LLM_FALLBACK=true` shows "Try harder" (Phase 10, off by default — `src/lib/flags.ts`).

## Images

- On upload: client-side resize to ≤ 1600 px, JPEG/WebP quality ~0.8, strip EXIF (canvas re-encode).
- Path: `{household_id}/{key_id}.jpg` in the private bucket `key-photos` (2 MB limit enforced by the bucket). Display through signed URLs; offline through Dexie thumbnails.

## Environment

See `.env.example`. Client vars are prefixed `VITE_` and are public by nature — never put secrets there.

## Deployment

- Frontend: static build on Vercel, Netlify or Cloudflare Pages with an SPA rewrite to `/index.html`; HTTPS by default.
- Supabase cloud project: the owner applies migrations (`supabase db push`), sets Site URL and redirect URLs, configures custom SMTP, and edits the "Magic Link"/OTP email template to show `{{ .Token }}`.
