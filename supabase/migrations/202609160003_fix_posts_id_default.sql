-- NoBiblio: guarantee automatic UUID generation for new posts
-- Run this after the previous NoBiblio migrations.

create extension if not exists "pgcrypto";

alter table public.posts
  alter column id set default gen_random_uuid();

-- Keep the insert contract explicit: clients should omit id for new posts.
comment on column public.posts.id is 'Generated automatically with gen_random_uuid(); omit this column on insert.';