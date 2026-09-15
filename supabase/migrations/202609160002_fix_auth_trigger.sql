-- NoBiblio: repair the auth profile trigger
-- Run this after 202609160001_nobiblio.sql in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are visible to their owner" on public.profiles;
create policy "Profiles are visible to their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
exception when others then
  -- A profile must never prevent Supabase Auth from creating the user.
  raise warning 'NoBiblio profile creation skipped for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Repair users created before the trigger was fixed.
insert into public.profiles (id, full_name)
select id, nullif(trim(raw_user_meta_data ->> 'full_name'), '')
from auth.users
on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
