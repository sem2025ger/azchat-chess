-- Private organizer drafts. No registration, publication or pairing is enabled.
create table public.individual_tournament_drafts (
  id uuid primary key,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  starts_at timestamptz not null check (isfinite(starts_at)),
  max_players smallint not null check (max_players between 2 and 128),
  created_at timestamptz not null default now()
);

create index individual_tournament_drafts_organizer_created_idx
  on public.individual_tournament_drafts (organizer_id, created_at desc);

alter table public.individual_tournament_drafts enable row level security;
revoke all on public.individual_tournament_drafts from public, anon, authenticated;
grant select on public.individual_tournament_drafts to authenticated;
grant insert (id, organizer_id, name, starts_at, max_players)
  on public.individual_tournament_drafts to authenticated;

create policy individual_draft_owner_read on public.individual_tournament_drafts
  for select to authenticated
  using (organizer_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true');

create policy individual_draft_owner_create on public.individual_tournament_drafts
  for insert to authenticated
  with check (organizer_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and starts_at > statement_timestamp());
