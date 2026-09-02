-- Public, read-only share links for a single session.
--
-- The bill itself stays in `sync_rows` under the owner's RLS. A share row maps a random
-- token to one session; anonymous visitors never touch `sync_rows` directly, they call
-- `get_shared_session(token)`, which is SECURITY DEFINER and returns only that session,
-- its bill lines, and the few display settings the page needs.

create table if not exists public.session_shares (
  token       text        primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  text        not null,
  created_at  timestamptz not null default now(),
  unique (user_id, session_id)
);

alter table public.session_shares enable row level security;

drop policy if exists "own shares" on public.session_shares;
create policy "own shares" on public.session_shares
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.get_shared_session(share_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'session', (
      select r.data from public.sync_rows r
      where r.user_id = s.user_id and r.collection = 'sessions'
        and r.id = s.session_id and r.deleted_at is null
    ),
    'entries', coalesce((
      select jsonb_agg(r.data order by (r.data->>'order')::numeric)
      from public.sync_rows r
      where r.user_id = s.user_id and r.collection = 'entries'
        and r.deleted_at is null and r.data->>'sessionId' = s.session_id
    ), '[]'::jsonb),
    'display', (
      select jsonb_build_object(
        'currency', coalesce(r.data->>'currency', '₱'),
        'visitorFeeLabel', coalesce(r.data->>'visitorFeeLabel', 'Visitor fee'),
        'playersPerGame', coalesce((r.data->>'playersPerGame')::int, 4)
      )
      from public.sync_rows r
      where r.user_id = s.user_id and r.collection = 'settings'
        and r.id = 'app' and r.deleted_at is null
    ),
    'sharedAt', s.created_at
  )
  from public.session_shares s
  where s.token = share_token;
$$;

revoke all on function public.get_shared_session(text) from public;
grant execute on function public.get_shared_session(text) to anon, authenticated;
