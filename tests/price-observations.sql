-- Run inside a transaction after applying the observation matching migration; roll it back afterwards.
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;

do $$
declare
  name text := 'test-' || gen_random_uuid()::text;
  first_hash text := repeat('a', 32) || md5(name);
  second_hash text := repeat('b', 32) || md5(name);
  third_hash text := repeat('c', 32) || md5(name);
  fourth_hash text := repeat('d', 32) || md5(name);
  fifth_hash text := repeat('e', 32) || md5(name);
  result record;
  price integer;
begin
  select * into result from public.record_price_observations(first_hash, '2026-01-01 09:00Z',
    jsonb_build_array(jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
      'current_price', 100, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00Z')));
  if result.inserted <> 1 or result.updated <> 0 then raise exception 'Initial insert failed'; end if;

  select * into result from public.record_price_observations(second_hash, '2026-01-01 09:30Z',
    jsonb_build_array(jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
      'current_price', 150, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:01Z')));
  if result.inserted <> 0 or result.updated <> 1 then raise exception 'One minute match failed'; end if;
  select current_price into price from public.price_observations where capture_hash = first_hash;
  if price is distinct from 150 then raise exception 'Price was not replaced'; end if;

  select * into result from public.record_price_observations(second_hash, '2026-01-01 09:30Z', '[]');
  if not result.duplicate then raise exception 'Duplicate import was not ignored'; end if;

  select * into result from public.record_price_observations(third_hash, '2026-01-01 09:15Z',
    jsonb_build_array(jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
      'current_price', 110, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00Z')));
  select current_price into price from public.price_observations where capture_hash = first_hash;
  if result.inserted <> 0 or result.updated <> 0 or price is distinct from 150 then raise exception 'Older capture replaced latest'; end if;

  select * into result from public.record_price_observations(fourth_hash, '2026-01-01 09:40Z',
    jsonb_build_array(
      jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
        'current_price', 200, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:01:01Z'),
      jsonb_build_object('position', 1, 'name_key', name, 'card_type', 'L',
        'current_price', 250, 'seller_key', 'autre', 'expires_at', '2026-01-01 10:00Z'),
      jsonb_build_object('position', 2, 'name_key', name, 'card_type', 'UR',
        'current_price', 300, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00Z'),
      jsonb_build_object('position', 3, 'name_key', name, 'card_type', 'L',
        'current_price', 350, 'seller_key', null, 'expires_at', '2026-01-01 10:00Z')));
  if result.inserted <> 4 or result.updated <> 0 or result.unmatched <> 1 then
    raise exception 'Distinct or unidentified listings were incorrectly matched';
  end if;

  select * into result from public.record_price_observations(fifth_hash, '2026-01-01 10:00:30Z',
    jsonb_build_array(jsonb_build_object('position', 0, 'name_key', name, 'card_type', 'L',
      'current_price', 175, 'seller_key', 'vendeur', 'expires_at', '2026-01-01 10:00:30Z')));
  select current_price into price from public.price_observations where capture_hash = first_hash;
  if result.updated <> 1 or price is distinct from 175 then raise exception 'Finished listing did not match'; end if;
end;
$$;
