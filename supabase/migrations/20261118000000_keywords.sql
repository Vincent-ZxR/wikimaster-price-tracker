create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  value text not null check (char_length(btrim(value)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.keywords enable row level security;
revoke all on table public.keywords from public, anon, authenticated;
grant select, insert on table public.keywords to service_role;

create index keywords_created_at_id_idx on public.keywords (created_at desc, id desc);
