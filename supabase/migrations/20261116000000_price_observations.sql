create table public.price_observations (
  capture_hash text not null check (capture_hash ~ '^[0-9a-f]{64}$'),
  position integer not null check (position between 0 and 999),
  name_key text not null check (char_length(name_key) between 1 and 200),
  card_type text not null check (card_type in ('L', 'UR', 'SR', 'R', 'PC', 'C')),
  current_price integer not null check (current_price between 1 and 1000000000),
  observed_at timestamptz not null default now(),
  primary key (capture_hash, position)
);

create index price_observations_lookup_idx
  on public.price_observations (name_key, card_type, observed_at desc);

alter table public.price_observations enable row level security;

create policy "Authenticated users can read price observations"
  on public.price_observations for select to authenticated using (true);

create policy "Authenticated users can insert price observations"
  on public.price_observations for insert to authenticated with check (true);

create function public.price_observation_summaries(keys jsonb)
returns table (name_key text, card_type text, sample_count bigint, lower_quartile double precision, upper_quartile double precision)
language sql stable security invoker
set search_path = ''
as $$
  select requested.name_key, requested.card_type, count(observation.current_price),
    percentile_cont(0.25) within group (order by observation.current_price),
    percentile_cont(0.75) within group (order by observation.current_price)
  from (
    select distinct key->>'name_key' as name_key, key->>'card_type' as card_type
    from jsonb_array_elements(keys) as key
  ) as requested
  cross join lateral (
    select p.current_price
    from public.price_observations p
    where p.name_key = requested.name_key
      and p.card_type = requested.card_type
      and p.observed_at >= now() - interval '90 days'
    order by p.observed_at desc
    limit 200
  ) as observation
  group by requested.name_key, requested.card_type;
$$;
