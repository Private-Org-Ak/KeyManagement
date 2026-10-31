-- SECURITY.md cases 5, 6, 9 and the rest of the role matrix.
begin;
\ir _helpers.psql
select plan(29);
select tests.create_fixture();

-- ---------- Members: can add/edit, cannot delete, invite or see invites (case 5) ----------
select tests.authenticate_as('member_a');
select lives_ok(format($$ insert into public.doors (household_id, name) values (%L, 'Member Door') $$, tests.hh('A')),
  'member can add a door');
select lives_ok(format($$ insert into public.keys (household_id, key_number) values (%L, 'M-1') $$, tests.hh('A')),
  'member can add a key');
select isnt_empty($$ update public.keys set holder = 'Me' where key_number = 'A-100' returning 1 $$,
  'member can edit a key');
select isnt_empty($$ update public.doors set notes = 'squeaky' where name = 'A Door' returning 1 $$,
  'member can edit a door');
select is_empty($$ delete from public.doors where name = 'A Door' returning 1 $$, 'member cannot delete a door');
select is_empty($$ delete from public.keys where key_number = 'A-100' returning 1 $$, 'member cannot delete a key');
select throws_ok(format($$ select public.create_invite(%L) $$, tests.hh('A')), '42501', null,
  'member cannot create_invite');
select is_empty($$ select 1 from public.invites $$, 'member cannot see invites');
select is_empty($$ delete from public.invites returning 1 $$, 'member cannot revoke invites');
select is_empty(format($$ update public.households set name = 'Renamed' where id = %L returning 1 $$, tests.hh('A')),
  'member cannot rename the household');
select is_empty(format($$ delete from public.households where id = %L returning 1 $$, tests.hh('A')),
  'member cannot delete the household');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('member2_a')),
  '42501', null, 'member cannot remove another member');
-- Privilege escalation: memberships have no update/insert policies.
select is_empty($$ update public.memberships set role = 'owner' where user_id = auth.uid() returning 1 $$,
  'member cannot promote themselves');
select is((select count(*)::int from public.memberships), 6, 'member can list the members of A');

-- ---------- Admins (case 6) ----------
select tests.authenticate_as('admin_a');
select isnt_empty($$ delete from public.keys where key_number = 'M-1' returning 1 $$, 'admin can delete a key');
select isnt_empty($$ delete from public.doors where name = 'Member Door' returning 1 $$, 'admin can delete a door');
select isnt_empty(format($$ update public.households set name = 'Home A2' where id = %L returning 1 $$, tests.hh('A')),
  'admin can rename the household');
select is((select count(*)::int from public.invites), 1, 'admin can see pending invites');
select lives_ok(format($$ select public.create_invite(%L, 'member') $$, tests.hh('A')), 'admin can invite a member');
select throws_ok(format($$ select public.create_invite(%L, 'admin') $$, tests.hh('A')), '42501', null,
  'admin cannot invite an admin');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('admin2_a')),
  '42501', null, 'admin cannot remove an admin');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('owner_a')),
  '42501', null, 'admin cannot remove the owner');
select is_empty(format($$ delete from public.households where id = %L returning 1 $$, tests.hh('A')),
  'admin cannot delete the household');
select lives_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('member2_a')),
  'admin can remove a member');

-- ---------- Owner (cases 6, 9) ----------
select tests.authenticate_as('owner_a');
select throws_ok(format($$ select public.create_invite(%L, 'owner') $$, tests.hh('A')), '22023', null,
  'nobody can invite an owner');
select lives_ok(format($$ select public.create_invite(%L, 'admin') $$, tests.hh('A')), 'owner can invite an admin');
select lives_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('admin2_a')),
  'owner can remove an admin');
select throws_ok(format($$ select public.leave_household(%L) $$, tests.hh('A')), '42501', null,
  'owner cannot leave_household (case 9)');
select isnt_empty(format($$ delete from public.households where id = %L returning 1 $$, tests.hh('A')),
  'owner can delete the household');

select * from finish();
rollback;
