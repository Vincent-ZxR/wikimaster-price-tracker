create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_name text not null,
  card_type text,
  subtitle text,
  current_price numeric check (current_price is null or current_price >= 0),
  starting_price numeric check (starting_price is null or starting_price >= 0),
  remaining_time text,
  seller text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists market_listings_user_captured_idx
  on public.market_listings (user_id, captured_at desc);

alter table public.market_listings enable row level security;

drop policy if exists "Users can read their own market listings"
  on public.market_listings;
create policy "Users can read their own market listings"
  on public.market_listings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own market listings"
  on public.market_listings;
create policy "Users can insert their own market listings"
  on public.market_listings for insert to authenticated
  with check ((select auth.uid()) = user_id);
