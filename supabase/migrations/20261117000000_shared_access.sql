begin;

lock table public.average_prices, public.average_price_history in access exclusive mode;

drop trigger if exists record_average_price_history on public.average_prices;
drop function if exists public.record_average_price_history();

create table public.average_prices_shared (
  card_name text not null check (char_length(btrim(card_name)) between 1 and 200),
  name_key text not null check (char_length(name_key) between 1 and 200),
  card_type text not null check (card_type in ('L', 'L✦', 'UR', 'SR', 'R', 'PC', 'C')),
  average_price integer not null check (average_price between 1 and 1000000000),
  primary key (name_key, card_type)
);

insert into public.average_prices_shared (card_name, name_key, card_type, average_price)
select distinct on (prices.name_key, prices.card_type)
  prices.card_name, prices.name_key, prices.card_type, prices.average_price
from public.average_prices as prices
left join lateral (
  select max(history.recorded_at) as latest_recorded_at
  from public.average_price_history as history
  where history.user_id = prices.user_id
    and history.name_key = prices.name_key
    and history.card_type = prices.card_type
) as latest on true
order by prices.name_key, prices.card_type, latest.latest_recorded_at desc nulls last, prices.user_id;

drop table public.average_prices;
alter table public.average_prices_shared rename to average_prices;
alter table public.average_prices enable row level security;

drop index public.average_price_history_lookup_idx;
drop policy if exists "Users can read their own average price history"
  on public.average_price_history;
alter table public.average_price_history drop column user_id;
create index average_price_history_lookup_idx
  on public.average_price_history (name_key, card_type, recorded_at, id);

create function public.record_average_price_history()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.average_price_history (name_key, card_type, average_price, recorded_at)
  values (new.name_key, new.card_type, new.average_price, now());
  return new;
end;
$$;

create trigger record_average_price_history
after insert or update of average_price on public.average_prices
for each row execute function public.record_average_price_history();

drop policy if exists "Authenticated users can read price observations"
  on public.price_observations;
drop policy if exists "Authenticated users can insert price observations"
  on public.price_observations;
drop policy if exists "Users can read their own market listings"
  on public.market_listings;
drop policy if exists "Users can insert their own market listings"
  on public.market_listings;

revoke all on table public.average_prices, public.average_price_history,
  public.price_observations, public.price_observation_imports, public.market_listings
  from public, anon, authenticated;
grant select, insert, update, delete on table public.average_prices,
  public.average_price_history, public.price_observations, public.price_observation_imports
  to service_role;

create or replace function public.record_price_observations(
  p_capture_hash text, p_captured_at timestamptz, p_observations jsonb
)
returns table (inserted integer, updated integer, unmatched integer, duplicate boolean)
language plpgsql security definer
set search_path = ''
as $$
declare
  observation record;
  existing public.price_observations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Shared access required';
  end if;
  if p_capture_hash is null or p_capture_hash !~ '^[0-9a-f]{64}$'
      or p_observations is null or jsonb_typeof(p_observations) <> 'array'
      or jsonb_array_length(p_observations) > 1000 then
    raise exception 'Invalid observations';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('price_observation_imports'));
  insert into public.price_observation_imports (capture_hash) values (p_capture_hash)
    on conflict do nothing;
  if not found then
    return query select 0, 0, 0, true;
    return;
  end if;

  inserted := 0;
  updated := 0;
  unmatched := 0;
  duplicate := false;

  for observation in
    select * from jsonb_to_recordset(p_observations) as item(
      position integer, name_key text, card_type text, current_price integer,
      seller_key text, expires_at timestamptz
    ) order by position
  loop
    if p_captured_at is null and observation.expires_at is not null then
      raise exception 'Expiration requires capture time';
    end if;
    if observation.seller_key is null or observation.expires_at is null then
      unmatched := unmatched + 1;
    else
      select p.* into existing
      from public.price_observations p
      where p.name_key = observation.name_key
        and p.card_type = observation.card_type
        and p.seller_key = observation.seller_key
        and p.expires_at between observation.expires_at - interval '1 minute'
                             and observation.expires_at + interval '1 minute'
      order by abs(extract(epoch from (p.expires_at - observation.expires_at))),
               p.captured_at desc, p.capture_hash, p.position
      limit 1;
      if found then
        if p_captured_at > existing.captured_at then
          update public.price_observations
          set current_price = observation.current_price,
              captured_at = p_captured_at,
              observed_at = now()
          where capture_hash = existing.capture_hash and position = existing.position;
          updated := updated + 1;
        end if;
        continue;
      end if;
    end if;

    insert into public.price_observations
      (capture_hash, position, name_key, card_type, current_price, seller_key, expires_at, captured_at)
    values
      (p_capture_hash, observation.position, observation.name_key, observation.card_type,
       observation.current_price, observation.seller_key, observation.expires_at, p_captured_at);
    inserted := inserted + 1;
  end loop;

  return next;
end;
$$;

revoke all on function public.record_price_observations(text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_price_observations(text, timestamptz, jsonb)
  to service_role;

revoke all on function public.price_observation_summaries(jsonb)
  from public, anon, authenticated;
grant execute on function public.price_observation_summaries(jsonb)
  to service_role;
revoke all on function public.price_tracking_cards()
  from public, anon, authenticated;
grant execute on function public.price_tracking_cards()
  to service_role;

revoke all on function public.record_average_price_history()
  from public, anon, authenticated;

commit;
