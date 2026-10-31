-- KeyFinder local development seed. Applied by `npm run db:reset` (local only — never prod).
--
-- Users (sign in with email OTP; read the code in Mailpit at http://127.0.0.1:54324):
--   alice@example.test — owner of "Alice's Home", member of "Bob's Flat"
--   bob@example.test   — owner of "Bob's Flat"
--
-- Seeding runs as the postgres superuser, so RLS doesn't apply here. Memberships are
-- inserted directly for that reason; the app itself only writes them through RPCs.

-- ---------- Users ----------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a11ce000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'alice@example.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'bob@example.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('alice@example.test', 'bob@example.test');

-- ---------- Households & memberships ----------
insert into public.households (id, name, created_by) values
  ('11111111-1111-4111-8111-111111111111', 'Alice''s Home', 'a11ce000-0000-4000-8000-000000000001'),
  ('22222222-2222-4222-8222-222222222222', 'Bob''s Flat',   'b0b00000-0000-4000-8000-000000000002');

insert into public.memberships (household_id, user_id, role, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'a11ce000-0000-4000-8000-000000000001', 'owner',  'Alice'),
  ('22222222-2222-4222-8222-222222222222', 'b0b00000-0000-4000-8000-000000000002', 'owner',  'Bob'),
  ('22222222-2222-4222-8222-222222222222', 'a11ce000-0000-4000-8000-000000000001', 'member', 'Alice');

-- ---------- Doors (Alice's Home: rooms with attached washrooms) ----------
insert into public.doors (id, household_id, name, room_group, floor, door_type) values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Main Door',                  null,             'Ground', 'main'),
  ('d0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Master Bedroom',             'Master Bedroom', 'First',  'room'),
  ('d0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Master Bedroom Washroom',    'Master Bedroom', 'First',  'washroom'),
  ('d0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Guest Room',                 'Guest Room',     'Ground', 'room'),
  ('d0000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Guest Room Washroom',        'Guest Room',     'Ground', 'washroom'),
  ('d0000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Store Room',                 null,             'Ground', 'store'),
  -- Bob's Flat
  ('d0000000-0000-4000-8000-000000000101', '22222222-2222-4222-8222-222222222222', 'Front Door',                 null,             null,     'main'),
  ('d0000000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222222', 'Bedroom',                    'Bedroom',        null,     'room');

-- ---------- Keys (both copies of a lock usually share one number) ----------
insert into public.keys (household_id, door_id, key_number, label, holder) values
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'KF-1021', 'Copy 1', 'Alice'),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'KF-1021', 'Copy 2', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', '4417',    'Copy 1', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', '4417',    'Copy 2', 'Cleaner'),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000003', '4418',    'Copy 1', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000004', 'B-208',   'Copy 1', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000005', 'B-209',   'Copy 1', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000006', '0S5',     null,     null),
  -- Bob's Flat
  ('22222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-000000000101', '7781',    'Copy 1', 'Bob'),
  ('22222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-000000000102', '7782',    'Copy 1', null);
