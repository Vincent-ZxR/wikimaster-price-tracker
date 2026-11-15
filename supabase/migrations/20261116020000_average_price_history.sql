begin;

lock table public.average_prices in share row exclusive mode;

create table public.average_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 200),
  card_type text not null check (card_type in ('L', 'UR', 'SR', 'R', 'PC', 'C')),
  average_price integer not null check (average_price between 1 and 1000000000),
  recorded_at timestamptz
);

create index average_price_history_lookup_idx
  on public.average_price_history (user_id, name_key, card_type, recorded_at, id);

alter table public.average_price_history enable row level security;

create policy "Users can read their own average price history"
  on public.average_price_history for select to authenticated
  using ((select auth.uid()) = user_id);

insert into public.average_price_history (user_id, name_key, card_type, average_price, recorded_at)
select user_id, name_key, card_type, average_price, null from public.average_prices;

create function public.record_average_price_history()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.average_price_history (user_id, name_key, card_type, average_price, recorded_at)
  values (new.user_id, new.name_key, new.card_type, new.average_price, now());
  return new;
end;
$$;

create trigger record_average_price_history
after insert or update of average_price on public.average_prices
for each row execute function public.record_average_price_history();

commit;
