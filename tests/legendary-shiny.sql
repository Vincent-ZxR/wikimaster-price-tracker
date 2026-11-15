-- Run inside a transaction after the shiny migration and roll it back afterwards.
do $$
declare
  user_id uuid;
begin
  select id into user_id from auth.users limit 1;
  if user_id is null then raise exception 'An existing test account is required'; end if;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
end;
$$;
set local role authenticated;

do $$
declare
  name text := 'test-' || gen_random_uuid()::text;
  hash text := repeat('f', 32) || md5(name);
  result record;
  count_prices integer;
begin
  insert into public.average_prices (user_id, card_name, name_key, card_type, average_price)
  values (auth.uid(), name, name, 'L', 300), (auth.uid(), name, name, 'L✦', 800);
  select count(*) into count_prices from public.average_price_history
  where user_id = auth.uid() and name_key = name and card_type in ('L', 'L✦');
  if count_prices <> 2 then raise exception 'Separate average price history was not recorded'; end if;

  select * into result from public.record_price_observations(hash, '2026-01-01 09:00Z',
    jsonb_build_array(
      jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
        'current_price', 100, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00Z'),
      jsonb_build_object('position', 1, 'name_key', name, 'card_type', 'L✦',
        'current_price', 400, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00Z')));
  if result.inserted <> 2 or result.updated <> 0 then
    raise exception 'Classic and shiny listings were merged';
  end if;
  select count(*) into count_prices from public.price_observation_summaries(
    jsonb_build_array(jsonb_build_object('name_key', name, 'card_type', 'L'),
                      jsonb_build_object('name_key', name, 'card_type', 'L✦')))
  where (card_type = 'L' and upper_quartile = 100)
     or (card_type = 'L✦' and upper_quartile = 400);
  if count_prices <> 2 then raise exception 'Observation summaries were not kept separate'; end if;
end;
$$;
