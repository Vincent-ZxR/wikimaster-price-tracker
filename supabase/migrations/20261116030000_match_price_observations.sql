alter table public.price_observations
  add column seller_key text check (seller_key is null or char_length(seller_key) between 1 and 200),
  add column expires_at timestamptz,
  add column captured_at timestamptz;

create index price_observations_listing_idx
  on public.price_observations (name_key, card_type, seller_key, expires_at)
  where seller_key is not null and expires_at is not null;

create table public.price_observation_imports (
  capture_hash text primary key check (capture_hash ~ '^[0-9a-f]{64}$')
);

alter table public.price_observation_imports enable row level security;

insert into public.price_observation_imports (capture_hash)
select distinct capture_hash from public.price_observations;

create function public.record_price_observations(
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
  if auth.uid() is null then
    raise exception 'Authentication required';
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

revoke all on function public.record_price_observations(text, timestamptz, jsonb) from public, anon;
grant execute on function public.record_price_observations(text, timestamptz, jsonb) to authenticated;
