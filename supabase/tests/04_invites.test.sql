-- SECURITY.md case 7: accept_invite validation. Codes are captured with psql \gset.
begin;
\ir _helpers.psql
select plan(16);
select tests.create_fixture();

-- Owner of A creates invites (plaintext returned once).
select tests.authenticate_as('owner_a');
select public.create_invite(tests.hh('A'), 'member')                       as good_code    \gset
select public.create_invite(tests.hh('A'), 'member')                       as expired_code \gset
select public.create_invite(tests.hh('A'), 'admin', '  Outsider@Test.Local ') as bound_code \gset
select public.create_invite(tests.hh('A'), 'member', 'someone-else@test.local') as wrong_email_code \gset

select ok(:'good_code' ~ '^[0-9A-F]{16}$', 'invite code is 16 uppercase hex chars');
select is_empty(format($$ select 1 from public.invites where code_hash = %L $$, :'good_code'),
  'plaintext code is not stored');
select is((select email from public.invites where code_hash = encode(extensions.digest(:'bound_code', 'sha256'), 'hex')),
  'outsider@test.local', 'bound email is stored trimmed and lowercased');

-- Expire one invite (as superuser).
select tests.reset_role();
update public.invites set expires_at = now() - interval '1 minute'
where code_hash = encode(extensions.digest(:'expired_code', 'sha256'), 'hex');

select tests.authenticate_as('outsider');
select throws_ok(format($$ select public.accept_invite(%L) $$, :'expired_code'), '22023', null, 'expired invite fails');
select throws_ok(format($$ select public.accept_invite(%L) $$, :'wrong_email_code'), '22023', null,
  'invite bound to another email fails');
select throws_ok($$ select public.accept_invite('0000000000000000') $$, '22023', null, 'unknown code fails');
select throws_ok($$ select public.accept_invite('') $$, '22023', null, 'empty code fails');
select throws_ok($$ select public.accept_invite(null) $$, '22023', null, 'null code fails');
select is_empty(format($$ select 1 from public.doors where household_id = %L $$, tests.hh('A')),
  'failed attempts grant no access');

-- Success: formatted, lowercase input is accepted (dashes/spaces ignored).
select is(
  public.accept_invite(lower(substr(:'good_code',1,4) || '-' || substr(:'good_code',5,4) || ' ' || substr(:'good_code',9)), 'Outy'),
  tests.hh('A'), 'valid invite succeeds and returns the household id');
select is((select role::text from public.memberships where household_id = tests.hh('A') and user_id = auth.uid()),
  'member', 'joined with the invited role');
select isnt_empty(format($$ select 1 from public.doors where household_id = %L $$, tests.hh('A')),
  'new member can now read A');

-- Single use.
select tests.authenticate_as('owner_b');
select throws_ok(format($$ select public.accept_invite(%L) $$, :'good_code'), '22023', null,
  'a used invite fails for someone else');
select tests.authenticate_as('outsider');
select throws_ok(format($$ select public.accept_invite(%L) $$, :'good_code'), '22023', null,
  'a used invite fails for the same user');

-- Email-bound invite works for the matching email (case-insensitive) and grants its role.
select lives_ok(format($$ select public.accept_invite(%L) $$, :'bound_code'), 'email-bound invite works for that email');
select is((select role::text from public.memberships where household_id = tests.hh('A') and user_id = auth.uid()),
  'member', 'existing membership is not changed by a second invite');

select * from finish();
rollback;
