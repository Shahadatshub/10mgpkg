-- Photos uploaded straight to the opening screen: shown there only, never in
-- an album or in the untitled section at the bottom. Safe to run again.
alter table public.photos
  add column if not exists hero_only boolean not null default false;
