-- SECURITY.md case 8 (+ create_household and leave_household): access changes take effect immediately.
begin;
\ir _helpers.psql
select plan(14);
select tests.create_fixture();

-- ---------- create_household ----------
select tests.authenticate_as('outsider');
select public.create_household('  Outsider Home ', 'Outy') as new_hh \gset
select is((select name from public.households where id = :'new_hh'), 'Outsider Home', 'create_household trims the name');
select is((select role::text from public.memberships where household_id = :'new_hh' and user_id = auth.uid()),
  'owner', 'creator becomes owner');
select throws_ok($$ select public.create_household('   ') $$, '23514', null, 'blank household name is rejected');

-- ---------- Case 8: removed member immediately loses access ----------
select tests.authenticate_as('member_a');
select isnt_empty($$ select 1 from public.keys $$, 'member_a can read keys before removal');

select tests.authenticate_as('owner_a');
select lives_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('member_a')),
  'owner removes member_a');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('member_a')),
  'P0002', null, 'removing a non-member reports not found');
select throws_ok(format($$ select public.remove_member(%L, %L) $$, tests.hh('A'), tests.uid('owner_a')),
  '22023', null, 'owner cannot remove themselves via remove_member');

select tests.authenticate_as('member_a');
select is_empty($$ select 1 from public.households $$, 'removed member sees 0 households');
select is_empty($$ select 1 from public.doors $$, 'removed member sees 0 doors');
select is_empty($$ select 1 from public.keys $$, 'removed member sees 0 keys');
select throws_ok(format($$ insert into public.keys (household_id, key_number) values (%L, 'Z') $$, tests.hh('A')),
  '42501', null, 'removed member cannot write');

-- ---------- leave_household ----------
select tests.authenticate_as('both');
select lives_ok(format($$ select public.leave_household(%L) $$, tests.hh('A')), 'member can leave A');
select results_eq($$ select name from public.households $$, array['Home B'], 'after leaving A, only B is visible');
select is_empty(format($$ select 1 from public.keys where household_id = %L $$, tests.hh('A')),
  'after leaving A, no A keys are visible');

select * from finish();
rollback;
