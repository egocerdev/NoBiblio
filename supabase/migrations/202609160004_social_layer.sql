-- NoBiblio social layer
-- Run after 202609160001, 202609160002 and 202609160003.
-- This migration is additive and does not delete existing data.

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists website_url text;

alter table public.posts add column if not exists published_at timestamptz;
update public.posts set published_at = coalesce(published_at, updated_at, created_at) where status = 'published' and published_at is null;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.author_ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  honesty_score smallint not null check (honesty_score between 1 and 5),
  reliability_score smallint not null check (reliability_score between 1 and 5),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_id, author_id),
  check (rater_id <> author_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'copyright', 'misinformation', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id, reported_user_id) = 1)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid not null references public.posts(id) on delete cascade,
  quote_text text not null check (char_length(trim(quote_text)) between 1 and 1000),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists comments_post_idx on public.comments(post_id, created_at desc);
create index if not exists ratings_author_idx on public.author_ratings(author_id);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists quotes_source_idx on public.quotes(source_post_id, created_at desc);

alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.author_ratings enable row level security;
alter table public.reports enable row level security;
alter table public.quotes enable row level security;

-- Public profile discovery and published feed.
drop policy if exists "Public profiles are visible" on public.profiles;
create policy "Public profiles are visible" on public.profiles for select using (true);

drop policy if exists "Published posts are public" on public.posts;
create policy "Published posts are public" on public.posts for select using (status = 'published' or auth.uid() = author_id);

-- Following.
drop policy if exists "Users can read their follows" on public.follows;
create policy "Users can read their follows" on public.follows for select using (auth.uid() = follower_id or auth.uid() = following_id);
drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id and follower_id <> following_id);
drop policy if exists "Users can change their follows" on public.follows;
create policy "Users can change their follows" on public.follows for update using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
drop policy if exists "Users can remove their follows" on public.follows;
create policy "Users can remove their follows" on public.follows for delete using (auth.uid() = follower_id);

-- Comments on public posts, with private editing/removal by their author.
drop policy if exists "Visible comments are public" on public.comments;
create policy "Visible comments are public" on public.comments for select using (status = 'visible' or auth.uid() = author_id);
drop policy if exists "Users can comment" on public.comments;
create policy "Users can comment" on public.comments for insert with check (auth.uid() = author_id);
drop policy if exists "Users can edit own comments" on public.comments;
create policy "Users can edit own comments" on public.comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "Users can delete own comments" on public.comments;
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- Ratings are readable in aggregate-like raw form and editable only by the rater.
drop policy if exists "Ratings are visible" on public.author_ratings;
create policy "Ratings are visible" on public.author_ratings for select using (true);
drop policy if exists "Users can rate authors" on public.author_ratings;
create policy "Users can rate authors" on public.author_ratings for insert with check (auth.uid() = rater_id and rater_id <> author_id);
drop policy if exists "Users can edit ratings" on public.author_ratings;
create policy "Users can edit ratings" on public.author_ratings for update using (auth.uid() = rater_id) with check (auth.uid() = rater_id);
drop policy if exists "Users can delete ratings" on public.author_ratings;
create policy "Users can delete ratings" on public.author_ratings for delete using (auth.uid() = rater_id);

-- Reports are private to the reporter and service-role moderation tools.
drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports" on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports" on public.reports for select using (auth.uid() = reporter_id);

-- Quotes are public, but only the quote owner can create or remove them.
drop policy if exists "Quotes are public" on public.quotes;
create policy "Quotes are public" on public.quotes for select using (true);
drop policy if exists "Users can create quotes" on public.quotes;
create policy "Users can create quotes" on public.quotes for insert with check (auth.uid() = author_id);
drop policy if exists "Users can delete quotes" on public.quotes;
create policy "Users can delete quotes" on public.quotes for delete using (auth.uid() = author_id);
