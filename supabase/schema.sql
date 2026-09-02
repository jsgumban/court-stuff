-- Court Bills cloud sync. Run once in the Supabase SQL editor (safe to re-run).
--
-- One table mirrors the app's local collections (players, sessions, entries, settings) as JSON.
-- Row Level Security keeps each user's rows private. Deletions are soft (deleted_at) so other
-- devices learn about them; an older write never overwrites a newer one (see the trigger).

create table if not exists public.sync_rows (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection  text        not null check (collection in ('players', 'sessions', 'entries', 'settings')),
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  bigint      not null,               -- client clock, ms since epoch; last write wins
  deleted_at  bigint,                             -- set = soft-deleted
  synced_at   timestamptz not null default now(), -- server clock; devices pull by this cursor
  primary key (user_id, collection, id)
);

create index if not exists sync_rows_user_synced_idx on public.sync_rows (user_id, synced_at);

create or replace function public.sync_rows_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- an older write from another device loses; skip silently
  end if;
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists sync_rows_guard on public.sync_rows;
create trigger sync_rows_guard
  before insert or update on public.sync_rows
  for each row execute function public.sync_rows_guard();

alter table public.sync_rows enable row level security;

drop policy if exists "own rows" on public.sync_rows;
create policy "own rows" on public.sync_rows
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Live updates between devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_rows'
  ) then
    alter publication supabase_realtime add table public.sync_rows;
  end if;
end;
$$;
