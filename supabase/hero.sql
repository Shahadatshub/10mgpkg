-- Adds the "show on the opening screen" switch to every photograph.
-- Safe to run more than once.
alter table public.photos
  add column if not exists in_hero boolean not null default false;
