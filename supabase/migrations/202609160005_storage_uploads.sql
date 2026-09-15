-- NoBiblio: storage for profile avatars and post cover images
-- Run after 202609160004_social_layer.sql.

insert into storage.buckets (id, name, public)
values
  ('profile-avatars', 'profile-avatars', true),
  ('post-covers', 'post-covers', true)
on conflict (id) do update set public = excluded.public;

-- Users may upload only inside their own folder: <auth.uid()>/<filename>.
drop policy if exists "Users can upload own avatar files" on storage.objects;
create policy "Users can upload own avatar files"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own avatar files" on storage.objects;
create policy "Users can update own avatar files"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and owner_id = auth.uid())
with check (bucket_id = 'profile-avatars' and owner_id = auth.uid());

drop policy if exists "Users can delete own avatar files" on storage.objects;
create policy "Users can delete own avatar files"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-avatars' and owner_id = auth.uid());

drop policy if exists "Users can upload own cover files" on storage.objects;
create policy "Users can upload own cover files"
on storage.objects for insert to authenticated
with check (bucket_id = 'post-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own cover files" on storage.objects;
create policy "Users can update own cover files"
on storage.objects for update to authenticated
using (bucket_id = 'post-covers' and owner_id = auth.uid())
with check (bucket_id = 'post-covers' and owner_id = auth.uid());

drop policy if exists "Users can delete own cover files" on storage.objects;
create policy "Users can delete own cover files"
on storage.objects for delete to authenticated
using (bucket_id = 'post-covers' and owner_id = auth.uid());
