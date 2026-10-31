-- Phase 10: per-user daily quota for the optional "Try harder" LLM OCR fallback.
-- Not household data (no household_id): it counts a user's own calls. Clients can't read or
-- write the table; the only access is consume_ocr_quota(), which also checks membership.

create table public.ocr_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default current_date,
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.ocr_usage enable row level security;
revoke all on public.ocr_usage from anon, authenticated;
-- No policies on purpose: direct access is denied for every client role.

-- Increments today's counter for the caller and returns true while within p_daily_limit.
-- Raises 42501 when the caller isn't a member of p_household_id.
create or replace function public.consume_ocr_quota(p_household_id uuid, p_daily_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_member(p_household_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.ocr_usage (user_id, day, count) values (v_uid, current_date, 1)
  on conflict (user_id, day) do update set count = public.ocr_usage.count + 1
  returning count into v_count;
  return v_count <= greatest(1, least(coalesce(p_daily_limit, 20), 1000));
end;
$$;

revoke execute on function public.consume_ocr_quota(uuid, integer) from public, anon;
grant  execute on function public.consume_ocr_quota(uuid, integer) to authenticated;
