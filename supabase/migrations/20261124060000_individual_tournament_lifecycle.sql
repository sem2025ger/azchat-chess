-- Requires the individual tournament drafts migration. All lifecycle writes go through service-only RPCs.
create table public.individual_tournament_events (
  id uuid primary key references public.individual_tournament_drafts(id) on delete cascade,
  status text not null default 'registration' check (status in ('registration','playing','finished','cancelled','pairing_blocked')),
  revision integer not null default 0,
  round_no smallint not null default 0 check (round_no between 0 and 7),
  round_limit smallint check (round_limit between 1 and 7),
  published_at timestamptz not null default now()
);
create table public.individual_tournament_players (
  event_id uuid not null references public.individual_tournament_events(id) on delete cascade,
  player_no smallint not null check (player_no > 0),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(name) between 1 and 40 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  primary key (event_id, player_no),
  unique (event_id, user_id)
);
create unique index individual_tournament_nickname on public.individual_tournament_players(event_id, lower(name));
create table public.individual_tournament_pairings (
  event_id uuid not null,
  round_no smallint not null check (round_no between 1 and 7),
  board_no smallint not null check (board_no between 1 and 64),
  white_no smallint not null,
  black_no smallint,
  result text check (result in ('1-0','0-1','1/2-1/2','bye')),
  primary key (event_id, round_no, board_no),
  foreign key (event_id, white_no) references public.individual_tournament_players(event_id, player_no),
  foreign key (event_id, black_no) references public.individual_tournament_players(event_id, player_no),
  check (white_no is distinct from black_no),
  check ((black_no is null) = (result is not distinct from 'bye'))
);

alter table public.individual_tournament_events enable row level security;
alter table public.individual_tournament_players enable row level security;
alter table public.individual_tournament_pairings enable row level security;
revoke all on public.individual_tournament_events, public.individual_tournament_players,
  public.individual_tournament_pairings from public, anon, authenticated;

create function public.individual_tournament_read(p_actor uuid, p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_id is null then coalesce((
    select jsonb_agg(to_jsonb(item)) from (
      select d.id, d.name, d.starts_at, d.max_players, e.status
      from public.individual_tournament_events e join public.individual_tournament_drafts d on d.id = e.id
      where e.status in ('registration','playing') or d.organizer_id = p_actor or exists (
        select 1 from public.individual_tournament_players where event_id = e.id and user_id = p_actor
      )
      order by (e.status in ('registration','playing')) desc, d.starts_at, d.id limit 50
    ) item
  ), '[]'::jsonb) else (
    select jsonb_build_object('id', d.id, 'name', d.name, 'starts_at', d.starts_at, 'max_players', d.max_players,
      'status', e.status, 'round_no', e.round_no, 'round_limit', e.round_limit,
      'organizer', coalesce(d.organizer_id = p_actor,false),
      'joined', exists (select 1 from public.individual_tournament_players where event_id = e.id and user_id = p_actor),
      'players', (select coalesce(jsonb_agg(jsonb_build_object('no', player_no, 'name', name)
        order by player_no), '[]'::jsonb) from public.individual_tournament_players where event_id = e.id),
      'pairs', (select coalesce(jsonb_agg(to_jsonb(p) - 'event_id' order by round_no, board_no),'[]'::jsonb)
        from public.individual_tournament_pairings p where event_id = e.id))
    from public.individual_tournament_events e join public.individual_tournament_drafts d on d.id = e.id
    where e.id = p_id
  ) end
$$;

create function public.individual_tournament_command(p_actor uuid, p_id uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.individual_tournament_drafts;
  e public.individual_tournament_events;
  game public.individual_tournament_pairings;
  title text := p_input->>'name';
  start_at timestamptz;
  seats smallint;
  score text := p_input->>'result';
begin
  if p_actor is null or p_id is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  if p_action = 'publish' then
    perform 1 from auth.users where id = p_actor for update;
    if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
    select * into d from public.individual_tournament_drafts where id = p_id;
    start_at := (p_input->>'starts_at')::timestamptz;
    seats := (p_input->>'max_players')::smallint;
    if d.id is not null and d.organizer_id <> p_actor then raise exception 'not_found' using errcode = 'P0002'; end if;
    if d.id is not null and title is not null and
        (d.name,d.starts_at,d.max_players) is distinct from (title,start_at,seats) then raise exception 'request_conflict'; end if;
    if exists (select 1 from public.individual_tournament_events where id = p_id) then
      return public.individual_tournament_read(p_actor,p_id);
    end if;
    if d.id is null and (title is null or start_at is null or seats is null) then raise exception 'not_found' using errcode = 'P0002'; end if;
    if coalesce(d.starts_at,start_at) <= clock_timestamp() then raise exception 'invalid_time'; end if;
    if (select count(*) from public.individual_tournament_events event
        join public.individual_tournament_drafts draft on draft.id = event.id
        where draft.organizer_id = p_actor and event.status in ('registration','playing')) >= 2 then raise exception 'create_limit'; end if;
    if d.id is null then
      insert into public.individual_tournament_drafts (id,organizer_id,name,starts_at,max_players)
        values (p_id,p_actor,title,start_at,seats);
    end if;
    insert into public.individual_tournament_events (id) values (p_id);
    return public.individual_tournament_read(p_actor,p_id);
  end if;
  select * into e from public.individual_tournament_events where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into strict d from public.individual_tournament_drafts where id = p_id;
  if p_action = 'join' and exists (
    select 1 from public.individual_tournament_players where event_id = p_id and user_id = p_actor
  ) then return public.individual_tournament_read(p_actor,p_id); end if;
  if p_action in ('join','leave') and (e.status <> 'registration' or clock_timestamp() >= d.starts_at)
    then raise exception 'registration_closed'; end if;
  if p_action in ('cancel','result') and d.organizer_id <> p_actor
    then raise exception 'not_allowed' using errcode = '42501'; end if;
  case p_action
    when 'join' then
      if (select count(*) from public.individual_tournament_players where event_id = p_id) >= d.max_players
        then raise exception 'event_full'; end if;
      insert into public.individual_tournament_players (event_id,player_no,user_id,name)
        select p_id,coalesce(max(player_no),0)+1,p_actor,title from public.individual_tournament_players where event_id = p_id;
    when 'leave' then
      delete from public.individual_tournament_players where event_id = p_id and user_id = p_actor;
    when 'cancel' then
      if e.status = 'finished' then raise exception 'invalid_state'; end if;
      update public.individual_tournament_events set status = 'cancelled' where id = p_id;
    when 'result' then
      if score is null or score not in ('1-0','0-1','1/2-1/2') then raise exception 'invalid_input' using errcode = '22023'; end if;
      select * into game from public.individual_tournament_pairings where event_id = p_id and black_no is not null
        and round_no = (p_input->>'round_no')::smallint and board_no = (p_input->>'board_no')::smallint;
      if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
      if game.result = score then return public.individual_tournament_read(p_actor,p_id); end if;
      if e.status <> 'playing' or game.round_no <> e.round_no or game.result is not null then raise exception 'result_conflict'; end if;
      update public.individual_tournament_pairings set result = score
        where event_id = p_id and round_no = game.round_no and board_no = game.board_no;
    else raise exception 'invalid_input' using errcode = '22023';
  end case;
  update public.individual_tournament_events set revision = revision + 1 where id = p_id;
  return public.individual_tournament_read(p_actor,p_id);
end
$$;

create function public.individual_tournament_due() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(item)), '[]'::jsonb) from (
    select e.id, e.revision, e.round_no, e.round_limit,
      (select coalesce(jsonb_agg(player_no order by md5(e.id::text || ':' || player_no::text),player_no),'[]'::jsonb)
        from public.individual_tournament_players where event_id = e.id) as seeds,
      (select coalesce(jsonb_agg(to_jsonb(p) - 'event_id' order by round_no,board_no),'[]'::jsonb)
        from public.individual_tournament_pairings p where event_id = e.id) as history
    from public.individual_tournament_events e join public.individual_tournament_drafts d on d.id = e.id
    where (e.status = 'registration' and d.starts_at <= statement_timestamp()) or
      (e.status = 'playing' and not exists (select 1 from public.individual_tournament_pairings
        where event_id = e.id and round_no = e.round_no and result is null))
    order by e.published_at,e.id limit 12
  ) item
$$;

create function public.individual_tournament_advance(p_id uuid, p_revision integer, p_pairs jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  e public.individual_tournament_events;
  players integer;
  distinct_players integer;
  assigned_players integer;
  rounds smallint;
begin
  select * into e from public.individual_tournament_events where id = p_id for update;
  if not found or e.revision <> p_revision then return false; end if;
  if e.status = 'registration' then
    if (select starts_at from public.individual_tournament_drafts where id = p_id) > clock_timestamp()
      then return false; end if;
  elsif e.status <> 'playing' or exists (select 1 from public.individual_tournament_pairings
    where event_id = p_id and round_no = e.round_no and result is null) then return false;
  end if;
  select count(*) into players from public.individual_tournament_players where event_id = p_id;
  rounds := coalesce(e.round_limit,ceil(log(2::numeric,greatest(players,2)::numeric))::smallint);
  if players < 2 or e.round_no >= rounds or p_pairs is null then
    update public.individual_tournament_events set revision = revision + 1,
      status = case when players < 2 then 'cancelled' when e.round_no >= rounds then 'finished' else 'pairing_blocked' end
      where id = p_id;
    return true;
  end if;
  if jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) <> (players + 1) / 2
    then raise exception 'invalid_pairings' using errcode = '22023'; end if;
  with plan as (select * from jsonb_to_recordset(p_pairs) as p(white_no smallint,black_no smallint)),
  seats as (select white_no as player from plan union all select black_no from plan where black_no is not null)
  select count(player),count(distinct player) into assigned_players,distinct_players from seats;
  if assigned_players <> players or distinct_players <> players or exists (
    select 1 from jsonb_to_recordset(p_pairs) as p(white_no smallint,black_no smallint)
    join public.individual_tournament_pairings old on old.event_id = p_id and (
      p.white_no = old.white_no and p.black_no is not distinct from old.black_no
      or p.white_no = old.black_no and p.black_no = old.white_no)
  ) then raise exception 'invalid_pairings' using errcode = '22023'; end if;
  insert into public.individual_tournament_pairings (event_id,round_no,board_no,white_no,black_no,result)
    select p_id,e.round_no+1,ord,(pair->>'white_no')::smallint,(pair->>'black_no')::smallint,
      case when pair->>'black_no' is null then 'bye' end
    from jsonb_array_elements(p_pairs) with ordinality as x(pair,ord);
  update public.individual_tournament_events set status = 'playing',round_limit = rounds,
    round_no = round_no + 1,revision = revision + 1 where id = p_id;
  return true;
end
$$;

revoke all on function public.individual_tournament_read(uuid,uuid),
  public.individual_tournament_command(uuid,uuid,text,jsonb),public.individual_tournament_due(),
  public.individual_tournament_advance(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.individual_tournament_read(uuid,uuid),
  public.individual_tournament_command(uuid,uuid,text,jsonb),public.individual_tournament_due(),
  public.individual_tournament_advance(uuid,integer,jsonb) to service_role;
