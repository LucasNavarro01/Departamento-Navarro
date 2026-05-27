-- Departamento Navarro · Supabase Auth + loyalty reservations
-- Run once in Supabase SQL Editor after enabling Google/Facebook/Apple providers.

create table if not exists public.loyalty_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  reservation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loyalty_profiles enable row level security;

drop policy if exists "Users can read own loyalty profile" on public.loyalty_profiles;
create policy "Users can read own loyalty profile"
  on public.loyalty_profiles for select
  using (auth.uid() = id);

drop policy if exists "Service full access loyalty profiles" on public.loyalty_profiles;
create policy "Service full access loyalty profiles"
  on public.loyalty_profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  checkin date not null,
  checkout date not null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  num_guests integer not null default 1,
  guests integer,
  pets boolean not null default false,
  message text,
  source text not null default 'direct',
  status text not null default 'pending',
  subtotal integer not null default 0,
  discount_pct integer not null default 0,
  discount_amount integer not null default 0,
  cleaning_fee integer not null default 0,
  total integer not null default 0,
  coupon_code text,
  created_at timestamptz not null default now()
);

alter table public.reservations add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.reservations add column if not exists guests integer;
alter table public.reservations add column if not exists pets boolean not null default false;
alter table public.reservations add column if not exists subtotal integer not null default 0;
alter table public.reservations add column if not exists discount_pct integer not null default 0;
alter table public.reservations add column if not exists discount_amount integer not null default 0;
alter table public.reservations add column if not exists cleaning_fee integer not null default 0;
alter table public.reservations add column if not exists total integer not null default 0;
alter table public.reservations add column if not exists coupon_code text;

alter table public.reservations enable row level security;

drop policy if exists "Users can read own reservations" on public.reservations;
create policy "Users can read own reservations"
  on public.reservations for select
  using (auth.uid() = user_id);

drop policy if exists "Service full access reservations" on public.reservations;
create policy "Service full access reservations"
  on public.reservations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists reservations_dates_idx on public.reservations (checkin, checkout);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_user_id_idx on public.reservations (user_id);
