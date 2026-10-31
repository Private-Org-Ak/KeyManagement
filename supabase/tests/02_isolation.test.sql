-- SECURITY.md cases 2, 3, 4: household isolation.
begin;
\ir _helpers.psql
select plan(26);
select tests.create_fixture();

-- ---------- Case 2: a non-member gets 0 rows from household A ----------
select tests.authenticate_as('outsider');
select is_empty(format($$ select 1 from public.households  where id = %L $$, tests.hh('A')), 'outsider: 0 households of A');
select is_empty(format($$ select 1 from public.doors       where household_id = %L $$, tests.hh('A')), 'outsider: 0 doors of A');
select is_empty(format($$ select 1 from public.keys        where household_id = %L $$, tests.hh('A')), 'outsider: 0 keys of A');
select is_empty(format($$ select 1 from public.memberships where household_id = %L $$, tests.hh('A')), 'outsider: 0 memberships of A');
select is_empty(format($$ select 1 from public.invites     where household_id = %L $$, tests.hh('A')), 'outsider: 0 invites of A');
select is_empty($$ select 1 from public.households $$, 'outsider sees no households at all');

-- Owner of B sees only B.
select tests.authenticate_as('owner_b');
select results_eq($$ select name from public.households $$, array['Home B'], 'owner_b sees only Home B');
select results_eq($$ select name from public.doors $$, array['B Door'], 'owner_b sees only B doors');
select results_eq($$ select key_number from public.keys $$, array['B-100'], 'owner_b sees only B keys');

-- A member of both sees both.
select tests.authenticate_as('both');
select is((select count(*)::int from public.households), 2, 'member of A and B sees both households');

-- ---------- Case 3: a non-member cannot write into household A ----------
select tests.authenticate_as('outsider');
select throws_ok(format($$ insert into public.doors (household_id, name) values (%L, 'Sneaky') $$, tests.hh('A')),
  '42501', null, 'outsider cannot insert a door into A');
select throws_ok(format($$ insert into public.keys (household_id, key_number) values (%L, '999') $$, tests.hh('A')),
  '42501', null, 'outsider cannot insert a key into A');
select is_empty(format($$ update public.doors set name = 'Hacked' where household_id = %L returning 1 $$, tests.hh('A')),
  'outsider updates 0 doors of A');
select is_empty(format($$ update public.keys set key_number = '0' where household_id = %L returning 1 $$, tests.hh('A')),
  'outsider updates 0 keys of A');
select is_empty(format($$ update public.households set name = 'Hacked' where id = %L returning 1 $$, tests.hh('A')),
  'outsider cannot rename A');
select is_empty(format($$ delete from public.doors where household_id = %L returning 1 $$, tests.hh('A')),
  'outsider deletes 0 doors of A');
select throws_ok(format($$ insert into public.memberships (household_id, user_id, role) values (%L, %L, 'owner') $$,
  tests.hh('A'), tests.uid('outsider')), '42501', null, 'outsider cannot add themselves to A');
select throws_ok(format($$ insert into public.invites (household_id, code_hash) values (%L, 'x') $$, tests.hh('A')),
  '42501', null, 'outsider cannot insert an invite for A');

-- Owner of B cannot move its own rows into A (with check on is_member of the new household).
select tests.authenticate_as('owner_b');
select throws_ok(format($$ update public.doors set household_id = %L where name = 'B Door' $$, tests.hh('A')),
  '42501', null, 'owner_b cannot move a door into A');
select throws_ok(format($$ insert into public.doors (household_id, name) values (%L, 'Sneaky') $$, tests.hh('A')),
  '42501', null, 'owner_b cannot insert a door into A');

-- ---------- Case 4: cross-household key → door link is rejected ----------
select tests.authenticate_as('both');
select throws_ok(
  format($$ insert into public.keys (household_id, door_id, key_number)
            select %L, id, 'X-1' from public.doors where name = 'B Door' $$, tests.hh('A')),
  '23503', null, 'member of A and B cannot link a new key in A to a door in B');
select throws_ok(
  $$ update public.keys set door_id = (select id from public.doors where name = 'B Door')
     where key_number = 'A-100' $$,
  '23503', null, 'member of A and B cannot re-point a key in A to a door in B');
select throws_ok(
  format($$ update public.keys set household_id = %L where key_number = 'A-100' $$, tests.hh('B')),
  '23503', null, 'moving a key to B while it still points at a door in A is rejected');
select lives_ok(
  format($$ insert into public.keys (household_id, door_id, key_number)
            select %L, id, 'A-200' from public.doors where name = 'A Door' $$, tests.hh('A')),
  'same-household key → door link works');

-- ---------- Sanity: nothing changed in A ----------
select tests.reset_role();
select is((select count(*)::int from public.doors where household_id = tests.hh('A') and name in ('Hacked','Sneaky')),
  0, 'no rogue doors in A');
select is((select name from public.households where id = tests.hh('A')), 'Home A', 'A was not renamed');

select * from finish();
rollback;
