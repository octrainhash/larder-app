-- Larder database. Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once.

-- Each user's app data, synced between their devices
create table if not exists public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Notification preferences
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  country text,
  notify_push boolean not null default false,
  notify_email boolean not null default false,
  tz text,
  updated_at timestamptz not null default now()
);

-- Browser push subscriptions (one per device)
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Products added by shoppers when Open Food Facts doesn't know them (local brands)
create table if not exists public.shared_products (
  code text primary key,
  data jsonb not null,
  added_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- Real prices and stock seen by shoppers, per store
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  code text not null,
  store_name text not null,
  store_osm text,
  lat double precision,
  lon double precision,
  country text,
  currency text,
  price numeric(12,2),
  in_stock boolean not null default true,
  reported_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint price_sane check (price is null or (price >= 0 and price < 1000000))
);
create index if not exists reports_code_time on public.reports (code, created_at desc);

-- What has already been notified, so nothing is sent twice
create table if not exists public.notif_log (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subs enable row level security;
alter table public.shared_products enable row level security;
alter table public.reports enable row level security;
alter table public.notif_log enable row level security;

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own subs" on public.push_subs;
create policy "own subs" on public.push_subs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read products" on public.shared_products;
create policy "read products" on public.shared_products for select to anon, authenticated using (true);
drop policy if exists "add products" on public.shared_products;
create policy "add products" on public.shared_products for insert to authenticated with check (added_by = auth.uid());

drop policy if exists "read reports" on public.reports;
create policy "read reports" on public.reports for select to anon, authenticated using (true);
drop policy if exists "add reports" on public.reports;
create policy "add reports" on public.reports for insert to authenticated with check (reported_by = auth.uid());
drop policy if exists "remove own reports" on public.reports;
create policy "remove own reports" on public.reports for delete to authenticated using (reported_by = auth.uid());
