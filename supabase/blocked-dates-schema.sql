-- Departamento Navarro · bloqueos manuales de calendario
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,           -- exclusiva (checkout): el dia end_date NO se bloquea
  reason text,                      -- ej: "Mantenimiento", "Uso personal"
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

drop policy if exists "Service full access blocked_dates" on public.blocked_dates;
create policy "Service full access blocked_dates"
  on public.blocked_dates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists blocked_dates_range_idx on public.blocked_dates (start_date, end_date);

create table if not exists public.calendar_rules (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,           -- exclusiva (checkout): el dia end_date NO se configura
  price_per_night integer,
  min_nights integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.calendar_rules enable row level security;

drop policy if exists "Service full access calendar_rules" on public.calendar_rules;
create policy "Service full access calendar_rules"
  on public.calendar_rules for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists calendar_rules_range_idx on public.calendar_rules (start_date, end_date);
