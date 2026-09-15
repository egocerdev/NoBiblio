-- NoBiblio: auth profile and post storage
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  slug text not null,
  excerpt text not null default '',
  content text not null default '',
  category text not null default 'Genel',
  status text not null default 'draft' check (status in ('draft', 'published')),
  cover_image text,
  font_family text not null default 'Inter',
  font_size integer not null default 18 check (font_size between 14 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, slug)
);

create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_status_idx on public.posts(status);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Profiles are visible to their owner" on public.profiles;
create policy "Profiles are visible to their owner" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can read their own posts" on public.posts;
create policy "Users can read their own posts" on public.posts for select using (auth.uid() = author_id);
drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts" on public.posts for insert with check (auth.uid() = author_id);
drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts" on public.posts for update using (auth.uid() = author_id);
drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts" on public.posts for delete using (auth.uid() = author_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
