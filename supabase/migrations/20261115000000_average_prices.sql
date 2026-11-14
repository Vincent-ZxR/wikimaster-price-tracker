create table if not exists public.average_prices (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_name text not null check (char_length(btrim(card_name)) between 1 and 200),
  name_key text not null check (char_length(name_key) between 1 and 200),
  card_type text not null check (card_type in ('L', 'UR', 'SR', 'R', 'PC', 'C')),
  average_price integer not null check (average_price between 1 and 1000000000),
  primary key (user_id, name_key, card_type)
);

alter table public.average_prices enable row level security;

create policy "Users can read their own average prices"
  on public.average_prices for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own average prices"
  on public.average_prices for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own average prices"
  on public.average_prices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own average prices"
  on public.average_prices for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own market listings"
  on public.market_listings;
