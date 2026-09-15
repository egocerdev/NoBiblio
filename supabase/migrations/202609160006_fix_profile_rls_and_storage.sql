-- NoBiblio: fix profile upsert RLS and normalize Storage policies
-- Run this single migration after 202609160005_storage_uploads.sql.
-- It is safe to run more than once.

-- The app uses upsert() for profile settings, so authenticated users need
-- INSERT permission for their own profile row as well as UPDATE permission.
alter table public.profiles enable row level security;

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Recreate Storage ownership checks using text casts. This works whether the
-- Supabase project exposes storage.objects.owner_id as uuid or text.
drop policy if exists "Users can upload own avatar files" on storage.objects;
create policy "Users can upload own avatar files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own avatar files" on storage.objects;
create policy "Users can update own avatar files"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and owner_id::text = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and owner_id::text = auth.uid()::text);

drop policy if exists "Users can delete own avatar files" on storage.objects;
create policy "Users can delete own avatar files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and owner_id::text = auth.uid()::text);

drop policy if exists "Users can upload own cover files" on storage.objects;
create policy "Users can upload own cover files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own cover files" on storage.objects;
create policy "Users can update own cover files"
  on storage.objects for update to authenticated
  using (bucket_id = 'post-covers' and owner_id::text = auth.uid()::text)
  with check (bucket_id = 'post-covers' and owner_id::text = auth.uid()::text);

drop policy if exists "Users can delete own cover files" on storage.objects;
create policy "Users can delete own cover files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-covers' and owner_id::text = auth.uid()::text);
