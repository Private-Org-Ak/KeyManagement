-- SECURITY.md case 1: `anon` cannot select or write any table, nor call any RPC.
begin;
\ir _helpers.psql
select plan(20);
select tests.create_fixture();

select tests.authenticate_as_anon();

-- Reads: nothing visible.
select is_empty($$ select 1 from public.households  $$, 'anon sees no households');
select is_empty($$ select 1 from public.memberships $$, 'anon sees no memberships');
select is_empty($$ select 1 from public.doors       $$, 'anon sees no doors');
select is_empty($$ select 1 from public.keys        $$, 'anon sees no keys');
select is_empty($$ select 1 from public.invites     $$, 'anon sees no invites');
select is_empty($$ select 1 from storage.objects where bucket_id = 'key-photos' $$,
  'anon sees no key photos');

-- Writes: rejected.
select throws_ok(format($$ insert into public.doors (household_id, name) values (%L, 'x') $$, tests.hh('A')),
  '42501', null, 'anon cannot insert doors');
select throws_ok(format($$ insert into public.keys (household_id, key_number) values (%L, 'x') $$, tests.hh('A')),
  '42501', null, 'anon cannot insert keys');
select throws_ok($$ insert into public.households (name) values ('x') $$,
  '42501', null, 'anon cannot insert households');
select throws_ok(format($$ insert into public.memberships (household_id, user_id) values (%L, %L) $$,
  tests.hh('A'), tests.uid('outsider')), '42501', null, 'anon cannot insert memberships');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('key-photos', %L) $$,
  tests.hh('A') || '/anon.jpg'), '42501', null, 'anon cannot upload key photos');

select is_empty($$ update public.doors set name = 'hacked' returning 1 $$, 'anon updates 0 doors');
select is_empty($$ delete from public.keys returning 1 $$, 'anon deletes 0 keys');

-- RPCs: execute revoked from anon.
select throws_ok($$ select public.create_household('x') $$, '42501', null, 'anon cannot create_household');
select throws_ok(format($$ select public.create_invite(%L) $$, tests.hh('A')), '42501', null,
  'anon cannot create_invite');
select throws_ok($$ select public.accept_invite('FIXTURECODE') $$, '42501', null, 'anon cannot accept_invite');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('member_a')),
  '42501', null, 'anon cannot remove_member');
select throws_ok(format($$ select public.leave_household(%L) $$, tests.hh('A')), '42501', null,
  'anon cannot leave_household');
select throws_ok(format($$ select public.is_member(%L) $$, tests.hh('A')), '42501', null,
  'anon cannot call is_member');

select tests.reset_role();
select is((select count(*)::int from public.doors where name = 'hacked'), 0, 'no door was changed by anon');

select * from finish();
rollback;
