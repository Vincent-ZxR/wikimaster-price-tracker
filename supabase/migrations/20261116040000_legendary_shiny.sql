alter table public.average_prices
  drop constraint average_prices_card_type_check,
  add constraint average_prices_card_type_check check (card_type in ('L', 'L✦', 'UR', 'SR', 'R', 'PC', 'C'));

alter table public.average_price_history
  drop constraint average_price_history_card_type_check,
  add constraint average_price_history_card_type_check check (card_type in ('L', 'L✦', 'UR', 'SR', 'R', 'PC', 'C'));

alter table public.price_observations
  drop constraint price_observations_card_type_check,
  add constraint price_observations_card_type_check check (card_type in ('L', 'L✦', 'UR', 'SR', 'R', 'PC', 'C'));
