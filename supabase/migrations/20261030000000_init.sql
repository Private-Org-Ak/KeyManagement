-- KeyFinder initial schema: households, memberships, doors, keys, invites,
-- RLS policies, RPCs and storage. Source of truth for authorization.
-- See docs/SECURITY.md. Never edit this file after it has been applied.

create extension if not exists pgcrypto with schema extensions;

-- ===================== Types =====================
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.door_type   as enum ('main', 'room', 'washroom', 'balcony', 'store', 'other');

-- ===================== Utility =====================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ===================== Tables =====================
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 80),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.memberships (
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.member_role not null default 'member',
  display_name  text check (display_name is null or char_length(display_name) <= 60),
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.doors (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 80),
  room_group    text check (room_group is null or char_length(room_group) <= 80),
  floor         text check (floor is null or char_length(floor) <= 40),
  door_type     public.door_type not null default 'room',
  notes         text check (notes is null or char_length(notes) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)            -- target for the composite FK from keys
);

create table public.keys (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  door_id       uuid,
  key_number    text not null check (char_length(trim(key_number)) between 1 and 40),
  -- Must match src/lib/normalize.ts: uppercase, strip non-alphanumerics.
  key_number_normalized text generated always as
                  (upper(regexp_replace(key_number, '[^A-Za-z0-9]', '', 'g'))) stored,
  label         text check (label is null or char_length(label) <= 40),     -- e.g. "Copy 1"
  holder        text check (holder is null or char_length(holder) <= 60),   -- who has it now
  photo_path    text check (photo_path is null or photo_path like household_id::text || '/%'),
  tag_id        text check (tag_id is null or char_length(tag_id) between 4 and 128),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- A key can only point at a door in the same household.
  foreign key (door_id, household_id)
    references public.doors (id, household_id) on delete set null (door_id)
);
create index keys_household_number_idx on public.keys (household_id, key_number_normalized);
create index keys_door_idx on public.keys (door_id);
create unique index keys_household_tag_uidx on public.keys (household_id, tag_id) where tag_id is not null;

create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  code_hash     text not null unique,                       -- sha256 hex of the code
  role          public.member_role not null default 'member' check (role <> 'owner'),
  email         text check (email is null or email = lower(email)),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  used_at       timestamptz,
  used_by       uuid references auth.users(id) on delete set null
);
create index invites_household_idx on public.invites (household_id);

create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger doors_updated_at before update on public.doors
  for each row execute function public.set_updated_at();
create trigger keys_updated_at before update on public.keys
  for each row execute function public.set_updated_at();

-- ===================== Authorization helpers =====================
create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_role(hh uuid, roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = hh and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Storage object names look like '<household_id>/<file>'. Unparseable → deny.
create or replace function public.can_access_photo(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  hh uuid;
begin
  hh := ((storage.foldername(object_name))[1])::uuid;
  return public.is_member(hh);
exception when others then
  return false;
end;
$$;

-- ===================== Row Level Security =====================
alter table public.households  enable row level security;
alter table public.memberships enable row level security;
alter table public.doors       enable row level security;
alter table public.keys        enable row level security;
alter table public.invites     enable row level security;

-- households: insert only via create_household(); only `name` is updatable.
revoke update on public.households from authenticated, anon;
grant  update (name) on public.households to authenticated;

create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using      (public.has_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_role(id, array['owner','admin']::public.member_role[]));
create policy households_delete on public.households for delete to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]));

-- memberships: read for members; all writes via RPCs.
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(household_id));

-- doors
create policy doors_select on public.doors for select to authenticated
  using (public.is_member(household_id));
create policy doors_insert on public.doors for insert to authenticated
  with check (public.is_member(household_id));
create policy doors_update on public.doors for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy doors_delete on public.doors for delete to authenticated
  using (public.has_role(household_id, array['owner','admin']::public.member_role[]));

-- keys
create policy keys_select on public.keys for select to authenticated
  using (public.is_member(household_id));
create policy keys_insert on public.keys for insert to authenticated
  with check (public.is_member(household_id));
create policy keys_update on public.keys for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy keys_delete on public.keys for delete to authenticated
  using (public.has_role(household_id, array['owner','admin']::public.member_role[]));

-- invites: owners/admins can see and revoke; creation via create_invite().
create policy invites_select on public.invites for select to authenticated
  using (public.has_role(household_id, array['owner','admin']::public.member_role[]));
create policy invites_delete on public.invites for delete to authenticated
  using (public.has_role(household_id, array['owner','admin']::public.member_role[]));

-- ===================== RPCs =====================
create or replace function public.create_household(p_name text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_hh  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.households (name, created_by) values (trim(p_name), v_uid)
  returning id into v_hh;
  insert into public.memberships (household_id, user_id, role, display_name)
  values (v_hh, v_uid, 'owner', nullif(trim(p_display_name), ''));
  return v_hh;
end;
$$;

create or replace function public.create_invite(
  p_household_id uuid,
  p_role public.member_role default 'member',
  p_email text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not public.has_role(p_household_id, array['owner','admin']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'cannot invite as owner' using errcode = '22023';
  end if;
  if p_role = 'admin' and not public.has_role(p_household_id, array['owner']::public.member_role[]) then
    raise exception 'only the owner can invite admins' using errcode = '42501';
  end if;

  v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));   -- 16 hex chars, 64 bits
  insert into public.invites (household_id, code_hash, role, email, created_by)
  values (
    p_household_id,
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    p_role,
    lower(nullif(trim(p_email), '')),
    auth.uid()
  );
  return v_code;   -- plaintext returned once, never stored
end;
$$;

create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  v_inv   public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.invites
  where code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found
     or v_inv.used_at is not null
     or v_inv.expires_at < now()
     or (v_inv.email is not null and v_inv.email is distinct from v_email) then
    raise exception 'invite is invalid or expired' using errcode = '22023';
  end if;

  insert into public.memberships (household_id, user_id, role, display_name)
  values (v_inv.household_id, v_uid, v_inv.role, nullif(trim(p_display_name), ''))
  on conflict (household_id, user_id) do nothing;

  update public.invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  return v_inv.household_id;
end;
$$;

create or replace function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_target public.member_role;
begin
  if not public.has_role(p_household_id, array['owner','admin']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_household to leave' using errcode = '22023';
  end if;

  select role into v_target from public.memberships
  where household_id = p_household_id and user_id = p_user_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if v_target = 'owner' then
    raise exception 'cannot remove the owner' using errcode = '42501';
  end if;
  if v_target = 'admin' and not public.has_role(p_household_id, array['owner']::public.member_role[]) then
    raise exception 'only the owner can remove admins' using errcode = '42501';
  end if;

  delete from public.memberships where household_id = p_household_id and user_id = p_user_id;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.has_role(p_household_id, array['owner']::public.member_role[]) then
    raise exception 'owner cannot leave; delete the household instead' using errcode = '42501';
  end if;
  delete from public.memberships
  where household_id = p_household_id and user_id = auth.uid();
end;
$$;

-- ===================== Function privileges =====================
revoke execute on function public.is_member(uuid)                                   from public, anon;
revoke execute on function public.has_role(uuid, public.member_role[])              from public, anon;
revoke execute on function public.can_access_photo(text)                            from public, anon;
revoke execute on function public.create_household(text, text)                      from public, anon;
revoke execute on function public.create_invite(uuid, public.member_role, text)     from public, anon;
revoke execute on function public.accept_invite(text, text)                         from public, anon;
revoke execute on function public.remove_member(uuid, uuid)                         from public, anon;
revoke execute on function public.leave_household(uuid)                             from public, anon;

grant execute on function public.is_member(uuid)                                    to authenticated;
grant execute on function public.has_role(uuid, public.member_role[])               to authenticated;
grant execute on function public.can_access_photo(text)                             to authenticated;
grant execute on function public.create_household(text, text)                       to authenticated;
grant execute on function public.create_invite(uuid, public.member_role, text)      to authenticated;
grant execute on function public.accept_invite(text, text)                          to authenticated;
grant execute on function public.remove_member(uuid, uuid)                          to authenticated;
grant execute on function public.leave_household(uuid)                              to authenticated;

-- ===================== Storage =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('key-photos', 'key-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy key_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'key-photos' and public.can_access_photo(name));
create policy key_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'key-photos' and public.can_access_photo(name));
create policy key_photos_update on storage.objects for update to authenticated
  using      (bucket_id = 'key-photos' and public.can_access_photo(name))
  with check (bucket_id = 'key-photos' and public.can_access_photo(name));
create policy key_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'key-photos' and public.can_access_photo(name));
