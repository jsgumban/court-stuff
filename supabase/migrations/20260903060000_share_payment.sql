-- Include the organiser's payment details (channel, account, QR image) in a shared bill,
-- so anyone opening the link can pay without asking for the number.
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
        'playersPerGame', coalesce((r.data->>'playersPerGame')::int, 4),
        'payment', r.data->'payment'
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
