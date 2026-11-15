create or replace function public.price_observation_summaries(keys jsonb)
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
    order by p.observed_at desc, p.capture_hash desc, p.position desc
    limit 200
  ) as observation
  group by requested.name_key, requested.card_type;
$$;

create function public.price_tracking_cards()
returns table (name_key text, card_type text, sample_count bigint, lower_quartile double precision, upper_quartile double precision)
language sql stable security invoker
set search_path = ''
as $$
  select cards.name_key, cards.card_type, summary.sample_count,
    summary.lower_quartile, summary.upper_quartile
  from (select distinct p.name_key, p.card_type from public.price_observations p) as cards
  cross join lateral (
    select count(*) as sample_count,
      percentile_cont(0.25) within group (order by recent.current_price) as lower_quartile,
      percentile_cont(0.75) within group (order by recent.current_price) as upper_quartile
    from (
      select p.current_price
      from public.price_observations p
      where p.name_key = cards.name_key and p.card_type = cards.card_type
        and p.observed_at >= now() - interval '90 days'
      order by p.observed_at desc, p.capture_hash desc, p.position desc
      limit 200
    ) as recent
  ) as summary
  order by cards.name_key, cards.card_type;
$$;
