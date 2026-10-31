-- Phase 10: OCR fallback quota (table locked down; RPC checks membership and limit).
begin;
\ir _helpers.psql
select plan(9);
select tests.create_fixture();

select tests.authenticate_as('member_a');
select throws_ok($$ select * from public.ocr_usage $$, '42501', null, 'clients cannot read ocr_usage');
select throws_ok(format($$ insert into public.ocr_usage (user_id) values (%L) $$, tests.uid('member_a')),
  '42501', null, 'clients cannot write ocr_usage');
select is(public.consume_ocr_quota(tests.hh('A'), 2), true, 'call 1 within limit');
select is(public.consume_ocr_quota(tests.hh('A'), 2), true, 'call 2 within limit');
select is(public.consume_ocr_quota(tests.hh('A'), 2), false, 'call 3 over the limit');

select tests.authenticate_as('outsider');
select throws_ok(format($$ select public.consume_ocr_quota(%L, 20) $$, tests.hh('A')), '42501', null,
  'non-member cannot use household A for OCR');

select tests.authenticate_as_anon();
select throws_ok(format($$ select public.consume_ocr_quota(%L, 20) $$, tests.hh('A')), '42501', null,
  'anon cannot call consume_ocr_quota');

select tests.reset_role();
select is((select count from public.ocr_usage where user_id = tests.uid('member_a')), 3, 'calls are counted per user per day');
select is((select count(*)::int from public.ocr_usage where user_id = tests.uid('outsider')), 0, 'rejected calls are not counted');

select * from finish();
rollback;
