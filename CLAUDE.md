# KeyFinder

A household PWA that tells you **which door a key opens**. Members of a household look up a key by typing its stamped number, scanning the number with the camera (on-device OCR), or scanning a QR/NFC tag on the key ring.

Real-world target: a home with ~10 rooms, each with an attached washroom → ~20 doors, 2 keys per lock → ~40 keys. Both keys of one lock usually carry the **same** number.

## Read before non-trivial work

- `docs/PRD.md` — what we're building, MVP scope, non-goals, screens
- `docs/ARCHITECTURE.md` — stack, folder layout, routing, offline, key matching, scanning pipeline
- `docs/SECURITY.md` — auth + household authorization model. **Non-negotiable.**
- `docs/ROADMAP.md` — phased tasks with acceptance criteria. Work through it in order.
- `docs/DECISIONS.md` — why things are the way they are; append when you deviate
- `supabase/migrations/` — schema + RLS are the source of truth for data and access rules

## Stack

- Vite + React + TypeScript (strict), React Router, TanStack Query, react-hook-form + Zod
- Tailwind CSS (mobile-first, light/dark)
- `vite-plugin-pwa` (Workbox) for installability + offline shell
- Supabase: Auth (email or phone + password; no auth emails/SMS), Postgres with RLS, Storage (private bucket `key-photos`)
- Dexie (IndexedDB) for the offline household cache
- Fuse.js + small Levenshtein helper for key-number matching
- Tesseract.js for OCR (lazy-loaded, self-hosted language data)
- QR: native `BarcodeDetector` → fallback `@zxing/browser`; QR generation with `qrcode`
- NFC: Web NFC (`NDEFReader`), Android Chrome only, feature-detected
- Tests: Vitest + Testing Library, Playwright, pgTAP (`supabase test db`)
- Hosting: static host (Vercel/Netlify/Cloudflare Pages) + Supabase cloud

## Commands

(Created in ROADMAP Phase 0 — keep these names.)

```
npm run dev          # Vite dev server
npm run dev:https    # Vite over HTTPS on LAN (camera testing on a phone)
npm run build        # production build
npm run preview      # serve the build (test SW/offline here, not in dev)
npm run phone        # build + serve on the LAN over HTTPS, Supabase proxied same-origin (phone testing)
npm run phone:tunnel # public HTTPS URL for `phone` via a Cloudflare quick tunnel (needs cloudflared)
npm run typecheck    # tsc -b (all tsconfigs set noEmit)
npm run lint         # eslint
npm test             # vitest run
npm run test:e2e     # playwright
npx supabase start   # local Supabase (requires Docker)
npm run db:reset     # supabase db reset (reapply migrations + seed)
npm run db:test      # supabase test db (pgTAP RLS tests)
npm run db:test:nomount  # same tests via docker cp (if Docker cannot mount this folder)
npm run db:types     # supabase gen types typescript --local > src/types/database.ts
npm run icons        # regenerate placeholder PWA icons
```

## Project structure

```
src/
  app/            router, providers, layout, error boundary
  features/
    auth/         login (email/phone + password), session guard
    households/   onboarding, switcher, members, invites, join
    doors/        list, detail, quick-add (room + washroom)
    keys/         detail/edit, photo upload, holder
    search/       home search, results, reverse lookup
    scan/         camera, ocr/, qr/, nfc/
  lib/            supabase.ts, db.ts (Dexie), normalize.ts, match.ts, image.ts
  components/ui/  shared primitives
  types/          database.ts (generated — do not edit by hand)
supabase/
  migrations/     SQL migrations (never edit an applied one)
  tests/          pgTAP tests
  functions/      edge functions (later: read-key-number)
public/tesseract/ self-hosted OCR worker, core and eng traineddata
docs/
```

## Hard rules

1. **Authorization lives in Postgres** (RLS + `security definer` RPCs). Client-side role checks only hide UI; they are never the protection.
2. **Never** use or reference the `service_role` key anywhere under `src/`. The client only gets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Every new table holding household data: `household_id not null`, RLS enabled, policies using `public.is_member()` / `public.has_role()`, and pgTAP tests proving a non-member sees 0 rows and cannot write. Use `/new-table`.
4. Schema change = new file in `supabase/migrations/`. Never edit an applied migration. Run `npm run db:types` after.
5. `memberships` and `invites` creation are written **only** via RPCs: `create_household`, `create_invite`, `accept_invite`, `remove_member`, `leave_household`.
6. Key-number normalization in `src/lib/normalize.ts` must match the DB generated column `keys.key_number_normalized` (uppercase, strip non-alphanumerics). Change both together.
7. No household data, key numbers or emails in URLs, logs, error reports or analytics. Exception: invite code in `/join/:code` (single-use, expiring).
8. The service worker must **not** cache Supabase API or Storage responses. Data offline comes only from Dexie.
9. On sign-out or loss of membership, wipe that household's Dexie data and cached thumbnails.
10. Lazy-load heavy code (Tesseract, zxing, qrcode). Justify any new runtime dependency in your summary; prefer platform APIs.
11. **Ask me first** before: adding paid services, changing auth method, changing the security model, running anything against a remote Supabase project (`supabase db push`, `link`).

## Conventions

- TypeScript strict; no `any` (use `unknown` + narrowing). Generated DB types from `src/types/database.ts`.
- Components never call `supabase` directly — go through hooks in `src/features/*/api.ts` (TanStack Query).
- Validate all form input with Zod; mirror DB length limits.
- Mobile-first: tap targets ≥ 44px, one-handed use, safe-area insets, works in light and dark mode.
- Show human-readable errors; map Postgres/RPC errors (see `docs/SECURITY.md#error-mapping`), never show raw messages.
- Unit-test everything in `src/lib/` (normalize, match, OCR post-processing). Playwright for core flows.
- Small conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.

## Workflow

- Beyond a small fix: plan first (files to touch, approach, tests), then implement. Use `/next-task`.
- One ROADMAP item at a time; tick its checkboxes only when the acceptance criteria pass.
- Done means: `npm run typecheck && npm run lint && npm test` pass, plus `npm run db:test` if the DB changed. Use `/check`.
- If you deviate from a doc, update that doc in the same change and add an entry to `docs/DECISIONS.md`.

## Gotchas

- **iOS installed PWAs have storage separate from Safari.** Magic links and OAuth redirects open in Safari, not the PWA, so the session never reaches the app → login is **email or phone + password** typed into the app (D30). Nothing is sent by email or SMS.
- Supabase only enables phone login when an SMS provider is configured. With phone confirmations off no SMS is sent, so placeholder Twilio values are enough (local `config.toml` and `docs/DEPLOY.md`). "Confirm email" and "Confirm phone" must be **off**, or sign-up returns no session.
- No self-service password reset (it would need email/SMS). Reset is an admin SQL step in `docs/DEPLOY.md`. Local seed users: `alice@example.test` / `bob@example.test` or `+919800000002`, password `keyfinder-dev`.
- Web NFC exists only in Chrome on Android. Feature-detect `'NDEFReader' in window`; hide NFC elsewhere. iPhone users use QR.
- `BarcodeDetector` is missing on iOS Safari → fall back to `@zxing/browser`.
- Camera (`getUserMedia`) requires HTTPS → use `npm run dev:https` for phone testing on LAN.
- iOS has no `beforeinstallprompt`; show manual "Share → Add to Home Screen" instructions.
- Service worker behaviour can't be judged in `npm run dev`; use `npm run build && npm run preview`.
- `npm run test:e2e` needs the local Supabase stack running; it builds and serves `preview` (with the production CSP) itself.
- Colima on macOS can't bind-mount folders under `~/Documents`: Studio and `supabase test db` fail. Use `npm run db:test:nomount`, or move the repo / switch to Docker Desktop or OrbStack. After editing `config.toml`, run `npx supabase stop --no-backup && npx supabase start -x studio` (restarting Colima alone revives containers with the old config).
- Production setup is in `docs/DEPLOY.md`.
