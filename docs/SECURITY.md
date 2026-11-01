# KeyFinder — Security Model

## Authentication (who are you?)

- Supabase Auth, **email or phone + password** (D30): `signUp` / `signInWithPassword` with `{ email, password }` or `{ phone, password }`. Phones are normalised to E.164 (`src/lib/identifier.ts`; 10-digit numbers get +91). Passwords: min 8 (server `minimum_password_length`), max 72.
- No email or SMS is sent: "Confirm email" and "Confirm phone" are off. Consequence: an account's email/phone is **not verified** — it is a login name, not proof of identity. Nothing may grant access based on it (invites are therefore not bound to an email any more; the single-use, expiring invite code is the protection).
- Brute force: Supabase rate-limits sign-in/sign-up per IP (`sign_in_sign_ups`). No self-service reset; an admin resets a password with SQL (`docs/DEPLOY.md`). Signed-in users can change their password on the Account screen.
- Why not magic links or OAuth: on iOS an installed PWA has its own storage, and links/redirects open in Safari, so the session never lands in the app.
- Supabase issues a short-lived JWT access token plus a refresh token; supabase-js persists and refreshes them. Each request carries the JWT, and inside Postgres `auth.uid()` is the user.
- The client holds only the anon/publishable key and the user's session. The `service_role` key must never ship to the client.

## Authorization (which household?)

Membership is data in `public.memberships (household_id, user_id, role)`. Every household-scoped table has RLS enabled, with policies built on two helpers:

- `public.is_member(hh uuid)` — the caller has any role in `hh`
- `public.has_role(hh uuid, roles member_role[])` — the caller has one of the given roles in `hh`

They are `security definer` with an empty `search_path`, so policies can read `memberships` without RLS recursion.

The household picked in the UI is just a filter. If a user asks for another household's rows, Postgres returns none. RLS `with check` blocks inserting or moving rows into a household the user doesn't belong to, and a composite foreign key ensures a key can only point at a door in its own household.

Membership is evaluated **live on every query** (no household claims inside the JWT), so removing a member revokes access on their very next request.

## Role matrix

| Action                                   |       owner        | admin | member |
| ---------------------------------------- | :----------------: | :---: | :----: |
| View household, doors, keys, members     |         ✓          |   ✓   |   ✓    |
| Add / edit doors and keys, upload photos |         ✓          |   ✓   |   ✓    |
| Delete doors and keys                    |         ✓          |   ✓   |   ✗    |
| Rename household                         |         ✓          |   ✓   |   ✗    |
| Invite as member                         |         ✓          |   ✓   |   ✗    |
| Invite as admin                          |         ✓          |   ✗   |   ✗    |
| View / revoke pending invites            |         ✓          |   ✓   |   ✗    |
| Remove a member                          |         ✓          |   ✓   |   ✗    |
| Remove an admin                          |         ✓          |   ✗   |   ✗    |
| Leave household                          | ✗ (delete instead) |   ✓   |   ✓    |
| Delete household                         |         ✓          |   ✗   |   ✗    |

## Writes that go through RPCs only

| RPC                                              | Why it's an RPC                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `create_household(p_name, p_display_name)`       | Inserts the household and the owner membership atomically (RLS would block the first membership row).          |
| `create_invite(p_household_id, p_role, p_email)` | Generates a random code, stores only its SHA-256 hash, and returns the plaintext once.                         |
| `accept_invite(p_code, p_display_name)`          | Validates hash, expiry, single use and the (legacy, unused by the UI) email binding, then adds the membership. |
| `remove_member(p_household_id, p_user_id)`       | Enforces the role rules above.                                                                                 |
| `leave_household(p_household_id)`                | Non-owners remove themselves.                                                                                  |

There are no insert/update/delete policies on `memberships` and no insert policy on `invites` or `households`.

## OCR fallback quota (Phase 10, optional)

- `public.ocr_usage(user_id, day, count)` — RLS on, **no policies**, all privileges revoked from `anon`/`authenticated`.
- `consume_ocr_quota(p_household_id, p_daily_limit)` (security definer): requires `is_member`, increments the caller's counter for today, returns whether they are within the limit (capped at 1000).
- The `read-key-number` Edge Function authenticates the caller's JWT with a user-scoped client, validates a ≤ 1 MB JPEG and a UUID household id, calls the RPC (403 non-member, 429 over limit), and only then calls the model. The Anthropic key lives in Supabase secrets; nothing about the household's keys is sent.

## Browser hardening

CSP + security headers from the host (see ARCHITECTURE.md › Security headers). Errors shown to users are mapped messages only; raw errors are logged to the console in dev builds only.

## Invites

- 16 hex characters (64 bits), shown formatted as `XXXX-XXXX-XXXX-XXXX`; input is case-insensitive and ignores dashes and spaces.
- Single-use, expire after 7 days by default, optionally bound to an email address.
- Shared through the Web Share API as `https://<app>/join/<code>` or as the code alone.
- Only the hash is stored, so a database leak doesn't reveal usable codes.

## Storage

- Private bucket `key-photos`, 2 MB limit, JPEG/PNG/WebP only.
- Object path must be `{household_id}/...`; storage policies call `can_access_photo(name)`, which parses the first folder as a UUID and checks `is_member` (an unparseable path means deny).
- `keys.photo_path` has a check constraint requiring the `{household_id}/` prefix.

## Client rules

- No household data, key numbers or emails in URLs (except invite codes), logs or analytics.
- The service worker doesn't cache Supabase API or Storage responses.
- Wipe Dexie on sign-out and for households the user has left or been removed from.
- Strip EXIF from uploaded photos.

## Error mapping

| Postgres / RPC error                    | User message                                                               |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `42501` (insufficient privilege / RLS)  | "You don't have permission to do that."                                    |
| `22023` from `accept_invite`            | "This invite is invalid, used or expired."                                 |
| `23505` on `doors(household_id, name)`  | "A door with that name already exists."                                    |
| `23505` on `keys(household_id, tag_id)` | "That tag is already assigned to another key."                             |
| `P0002` from `remove_member`            | "That person is no longer a member." (refresh the list)                    |
| `28000`                                 | Session expired → redirect to login                                        |
| Network error                           | "You're offline. Lookups still work; changes need a connection."           |
| HTTP 5xx (incl. 502/503/504 timeouts)   | "The server had a problem. Please try again in a minute."                  |
| HTTP 5xx while sending the sign-in code | "We couldn't send the email right now. Please try again in a few minutes." |

## Required RLS tests (pgTAP, `supabase/tests/`)

Helpers live in `supabase/tests/_helpers.psql` (included by each `*.test.sql` inside its transaction, so everything is rolled back): `tests.create_fixture()`, `tests.authenticate_as(handle)` (sets role + `request.jwt.claims`), `tests.authenticate_as_anon()`, `tests.reset_role()`. Storage delete tests set `storage.allow_delete_query = true` (as the Storage API does) so they exercise the RLS policy rather than Storage's raw-SQL delete guard. Cover at least:

1. `anon` cannot select or write any table.
2. A non-member gets 0 rows from households, doors, keys, memberships and invites of household A.
3. A non-member cannot insert a door or key into household A.
4. A member of A and B cannot link a key in A to a door in B (FK error).
5. A member cannot delete doors/keys, cannot call `create_invite`, and cannot see invites.
6. An admin cannot invite an admin or remove an admin; the owner can.
7. `accept_invite` fails for expired, used, wrong-email and bad codes; succeeds once; a second use fails.
8. After `remove_member`, the removed user immediately gets 0 rows.
9. The owner cannot `leave_household`.
10. Storage: a non-member cannot read or write objects under `A/…`; a path that isn't a UUID is denied.
11. (Phase 10) `ocr_usage` is unreadable/unwritable by clients; `consume_ocr_quota` rejects non-members and enforces the limit.
