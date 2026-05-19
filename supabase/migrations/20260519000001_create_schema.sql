-- ============================================================
-- AMPLOP — Schema Migration 1: Tables
-- ============================================================

-- households
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- users (extends auth.users)
create table users (
  id                uuid primary key references auth.users(id) on delete cascade,
  household_id      uuid not null references households(id) on delete cascade,
  email             text not null,
  display_name      text not null,
  display_currency  text not null default 'IDR',
  created_at        timestamptz not null default now()
);

create index users_household_id_idx on users(household_id);

-- categories
create table categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index categories_household_id_idx on categories(household_id);

-- trips
create table trips (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  start_date    date not null,
  end_date      date not null,
  currency      text not null default 'IDR',
  status        text not null default 'active' check (status in ('active', 'ended')),
  created_at    timestamptz not null default now()
);

create index trips_household_id_idx on trips(household_id);

-- envelopes
-- parent_envelope_id: self-ref for trip sub-envelopes that draw from a main envelope
-- trip_id: set when this envelope belongs to a trip
create table envelopes (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  category_id         uuid references categories(id) on delete set null,
  trip_id             uuid references trips(id) on delete cascade,
  parent_envelope_id  uuid,  -- FK added below after table exists
  name                text not null,
  budget_amount       integer not null default 0,  -- minor units of budget_currency
  budget_currency     text not null default 'IDR',
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

-- self-reference added after table creation
alter table envelopes
  add constraint envelopes_parent_fkey
  foreign key (parent_envelope_id) references envelopes(id) on delete cascade;

create index envelopes_household_id_idx on envelopes(household_id);
create index envelopes_category_id_idx on envelopes(category_id);
create index envelopes_trip_id_idx on envelopes(trip_id);

-- transactions
-- amount_idr_snapshot and fx_rate_snapshot are locked at entry time and never change
create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  user_id             uuid not null references users(id) on delete restrict,
  amount              integer not null,          -- minor units of currency
  currency            text not null default 'IDR',
  amount_idr_snapshot integer not null,          -- IDR equivalent at entry, locked forever
  fx_rate_snapshot    numeric(20, 6) not null,   -- rate used at entry, locked forever
  date                date not null,
  merchant_name       text,
  notes               text,
  location_lat        numeric(10, 7),
  location_lng        numeric(10, 7),
  location_name       text,
  created_at          timestamptz not null default now()
);

create index transactions_household_id_idx on transactions(household_id);
create index transactions_user_id_idx on transactions(user_id);
create index transactions_date_idx on transactions(date desc);

-- transaction_allocations
-- amount is in the same currency as the parent transaction
-- sum of all allocations for a transaction must equal transaction.amount
create table transaction_allocations (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  envelope_id     uuid not null references envelopes(id) on delete restrict,
  amount          integer not null,
  created_at      timestamptz not null default now()
);

create index ta_transaction_id_idx on transaction_allocations(transaction_id);
create index ta_envelope_id_idx on transaction_allocations(envelope_id);

-- fx_rates
-- currency_pair format: 'USD/IDR' means 1 USD = rate IDR
-- one row per pair per fetch; query the latest by fetched_at desc
create table fx_rates (
  id             uuid primary key default gen_random_uuid(),
  currency_pair  text not null,
  rate           numeric(20, 6) not null,
  fetched_at     timestamptz not null default now()
);

create index fx_rates_pair_time_idx on fx_rates(currency_pair, fetched_at desc);

-- voice_commands
create table voice_commands (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  user_id        uuid not null references users(id) on delete restrict,
  transcript     text not null,
  parsed_action  jsonb,
  confirmed      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index voice_commands_household_id_idx on voice_commands(household_id);
