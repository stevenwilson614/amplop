-- ============================================================
-- AMPLOP — Schema Migration 2: RLS Policies
-- Run AFTER migration 1
-- ============================================================

-- Enable RLS on every table
alter table households          enable row level security;
alter table users               enable row level security;
alter table categories          enable row level security;
alter table envelopes           enable row level security;
alter table trips               enable row level security;
alter table transactions        enable row level security;
alter table transaction_allocations enable row level security;
alter table fx_rates            enable row level security;
alter table voice_commands      enable row level security;

-- ============================================================
-- Helper function
-- Returns the household_id of the currently authenticated user.
-- SECURITY DEFINER so it can read the users table without
-- triggering an infinite RLS loop on that table.
-- ============================================================
create or replace function get_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from users where id = auth.uid()
$$;

-- ============================================================
-- households
-- A user may only see their own household.
-- Insert/update/delete are handled by the application server
-- using the service role key (e.g., onboarding edge function).
-- ============================================================
create policy "households_select_own"
  on households for select
  using (id = get_user_household_id());

-- ============================================================
-- users
-- Members can read everyone in their household.
-- A user can only insert/update their own row.
-- ============================================================
create policy "users_select_household"
  on users for select
  using (household_id = get_user_household_id());

create policy "users_insert_own"
  on users for insert
  with check (id = auth.uid());

create policy "users_update_own"
  on users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- categories
-- Full access for all household members.
-- ============================================================
create policy "categories_household_all"
  on categories for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());

-- ============================================================
-- envelopes
-- Full access for all household members.
-- ============================================================
create policy "envelopes_household_all"
  on envelopes for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());

-- ============================================================
-- trips
-- Full access for all household members.
-- ============================================================
create policy "trips_household_all"
  on trips for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());

-- ============================================================
-- transactions
-- Full access for all household members.
-- ============================================================
create policy "transactions_household_all"
  on transactions for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());

-- ============================================================
-- transaction_allocations
-- No household_id column — access is gated via the parent
-- transaction's household_id.
-- ============================================================
create policy "allocations_household_all"
  on transaction_allocations for all
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
        and t.household_id = get_user_household_id()
    )
  )
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
        and t.household_id = get_user_household_id()
    )
  );

-- ============================================================
-- fx_rates
-- Public read — anyone authenticated can see rates.
-- Writes come only from the cron Edge Function via service role
-- (no client-side INSERT/UPDATE/DELETE policy).
-- ============================================================
create policy "fx_rates_public_read"
  on fx_rates for select
  using (true);

-- ============================================================
-- voice_commands
-- Full access for all household members.
-- ============================================================
create policy "voice_commands_household_all"
  on voice_commands for all
  using (household_id = get_user_household_id())
  with check (household_id = get_user_household_id());
