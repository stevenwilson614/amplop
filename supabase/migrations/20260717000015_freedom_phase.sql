-- ============================================================
-- AMPLOP — Freedom Phase
-- Budget year, sinking funds, cash snapshots
-- ============================================================

-- households: budget year start month (1 = January)
alter table households
  add column if not exists budget_year_start_month integer not null default 1
  check (budget_year_start_month between 1 and 12);

-- envelopes: monthly vs sinking + optional goal
alter table envelopes
  add column if not exists kind text not null default 'monthly'
  check (kind in ('monthly', 'sinking'));

alter table envelopes
  add column if not exists target_amount integer;

alter table envelopes
  add column if not exists target_currency text;

alter table envelopes
  add column if not exists due_date date;

-- cash_snapshots: manual liquid cash position over time
create table if not exists cash_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  as_of_date          date not null,
  amount              integer not null,
  currency            text not null default 'IDR',
  amount_idr_snapshot integer not null,
  fx_rate_snapshot    numeric(20, 6) not null,
  notes               text,
  created_by          uuid not null references users(id) on delete restrict,
  created_at          timestamptz not null default now()
);

create index if not exists cash_snapshots_household_date_idx
  on cash_snapshots(household_id, as_of_date desc);

alter table cash_snapshots enable row level security;

create policy "cash_snapshots_household_all"
  on cash_snapshots for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());
