create temporary table charity_dedup as
select id, name,
       first_value(id) over (partition by name order by created_at asc, id asc) as keep_id
from public.charities;

update public.profiles p
set charity_id = c.keep_id
from charity_dedup c
where p.charity_id = c.id and c.id <> c.keep_id;

update public.donations d
set charity_id = c.keep_id
from charity_dedup c
where d.charity_id = c.id and c.id <> c.keep_id;

delete from public.charities ch
using charity_dedup c
where ch.id = c.id and c.id <> c.keep_id;

drop table charity_dedup;

alter table public.charities add constraint charities_name_key unique (name);

create table if not exists public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  description text,
  location text,
  event_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_charity_events_charity_id on public.charity_events(charity_id);
alter table public.charity_events enable row level security;

drop policy if exists "charity_events_select_for_visible_charity" on public.charity_events;
create policy "charity_events_select_for_visible_charity" on public.charity_events
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.charities c
      where c.id = charity_events.charity_id and (c.is_active = true or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "charity_events_admin_manage" on public.charity_events;
create policy "charity_events_admin_manage" on public.charity_events
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.subscriptions add column if not exists amount_cents integer;
alter table public.subscriptions add column if not exists currency text not null default 'usd';
alter table public.donations add column if not exists stripe_ref text;

create or replace function public.admin_report()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'active_subscribers', (select count(*) from public.subscriptions where status = 'active'),
    'total_prize_pool', (select coalesce(sum(prize_pool_total), 0) from public.draws where status = 'published'),
    'total_paid_out', (select coalesce(sum(prize_amount), 0) from public.winners where payment_status = 'paid'),
    'total_pending_payout', (
      select coalesce(sum(prize_amount), 0) from public.winners
      where verification_status = 'approved' and payment_status = 'pending'
    ),
    'charity_total', (select coalesce(sum(amount), 0) from public.donations),
    'charity_from_subscriptions', (
      select coalesce(sum(amount), 0) from public.donations where contribution_type = 'subscription_pledge'
    ),
    'charity_independent', (
      select coalesce(sum(amount), 0) from public.donations where contribution_type = 'independent_donation'
    ),
    'draws_published', (select count(*) from public.draws where status = 'published'),
    'winners_total', (select count(*) from public.winners),
    'jackpot_rollovers', (select count(*) from public.draws where five_match_rollover_out = true),
    'by_charity', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'total', totals.total) order by totals.total desc), '[]'::jsonb)
      from (
        select charity_id, sum(amount) as total
        from public.donations
        group by charity_id
      ) totals
      join public.charities c on c.id = totals.charity_id
    )
  )
  where public.is_admin(auth.uid());
$$;

grant execute on function public.admin_report() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('winner-proofs', 'winner-proofs', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "winner_proofs_owner_upload" on storage.objects;
create policy "winner_proofs_owner_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'winner-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "winner_proofs_owner_read" on storage.objects;
create policy "winner_proofs_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'winner-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

update public.profiles set role = 'admin' where email = 'sleepyysoulss@gmail.com' and role <> 'admin';