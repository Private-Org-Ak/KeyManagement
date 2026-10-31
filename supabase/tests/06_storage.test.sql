-- SECURITY.md case 10: key-photos storage isolation + keys.photo_path prefix check.
begin;
\ir _helpers.psql
select plan(12);
select tests.create_fixture();

select is((select public from storage.buckets where id = 'key-photos'), false, 'key-photos bucket is private');

-- Non-member.
select tests.authenticate_as('outsider');
select is_empty($$ select 1 from storage.objects where bucket_id = 'key-photos' $$,
  'outsider cannot list or read objects under A/');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('key-photos', %L) $$,
  tests.hh('A') || '/evil.jpg'), '42501', null, 'outsider cannot upload under A/');
select is_empty($$ update storage.objects set metadata = '{}' where bucket_id = 'key-photos' returning 1 $$,
  'outsider cannot overwrite objects under A/');
-- Storage blocks raw SQL deletes with a trigger unless this is set (the Storage API sets it
-- for its own deletes); set it so we test our RLS delete policy, not that guard.
set local storage.allow_delete_query = 'true';
select is_empty($$ delete from storage.objects where bucket_id = 'key-photos' returning 1 $$,
  'outsider cannot delete objects under A/');

-- Member.
select tests.authenticate_as('member_a');
select isnt_empty($$ select 1 from storage.objects where bucket_id = 'key-photos' $$, 'member can read photos of A');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('key-photos', %L) $$,
  tests.hh('A') || '/new.jpg'), 'member can upload under A/');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('key-photos', 'not-a-uuid/x.jpg') $$,
  '42501', null, 'a path whose first folder is not a UUID is denied');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('key-photos', 'x.jpg') $$,
  '42501', null, 'a path with no household folder is denied');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('key-photos', %L) $$,
  tests.hh('B') || '/x.jpg'), '42501', null, 'member of A cannot upload under B/');
select isnt_empty($$ delete from storage.objects where name like '%/new.jpg' returning 1 $$,
  'member can delete (replace) photos of A');

-- photo_path must live under the key's own household folder.
select throws_ok(
  format($$ update public.keys set photo_path = %L where key_number = 'A-100' $$, tests.hh('B') || '/k.jpg'),
  '23514', null, 'keys.photo_path pointing at another household is rejected');

select * from finish();
rollback;
